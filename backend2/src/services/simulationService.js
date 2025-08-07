const cron = require('node-cron');
const { query, transaction } = require('../database/connection');
const logger = require('../utils/logger');

class SimulationService {
  static cronJob = null;

  // Start the simulation update cron job
  static startSimulationUpdates() {
    // Run every 2 hours
    this.cronJob = cron.schedule('0 */2 * * *', async () => {
      logger.info('Starting simulation updates...');
      await this.updateAllActiveSimulations();
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    logger.info('Simulation update cron job started (every 2 hours)');
  }

  // Stop the cron job
  static stopSimulationUpdates() {
    if (this.cronJob) {
      this.cronJob.stop();
      logger.info('Simulation update cron job stopped');
    }
  }

  // Create a new simulation
  static async createSimulation(resumeId, subscriptionId, countryCode) {
    try {
      return await transaction(async (client) => {
        // Get resume details
        const resumeResult = await client.query(
          'SELECT * FROM resumes WHERE id = $1',
          [resumeId]
        );

        if (resumeResult.rows.length === 0) {
          throw new Error('Resume not found');
        }

        const resume = resumeResult.rows[0];

        // Get country employer count
        const countryResult = await client.query(
          'SELECT total_employers FROM countries WHERE code = $1',
          [countryCode]
        );

        if (countryResult.rows.length === 0) {
          throw new Error('Country not found');
        }

        const totalEmployers = countryResult.rows[0].total_employers;

        // Calculate simulation parameters based on resume scores
        const simulationParams = this.calculateSimulationParameters(resume, totalEmployers);

        // Create simulation record
        const simulationResult = await client.query(`
          INSERT INTO resume_simulations (
            resume_id, subscription_id, country_code, total_employers,
            simulation_start, simulation_end, duration_hours,
            target_opens, target_shortlists, status
          ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, $7, $8, 'running')
          RETURNING *
        `, [
          resumeId,
          subscriptionId,
          countryCode,
          totalEmployers,
          simulationParams.endTime,
          simulationParams.durationHours,
          simulationParams.targetOpens,
          simulationParams.targetShortlists
        ]);

        const simulation = simulationResult.rows[0];

        // Create initial dashboard metric
        await client.query(`
          INSERT INTO dashboard_metrics (
            simulation_id, timestamp, opens_count, shortlists_count,
            employers_reached, progress_percentage
          ) VALUES ($1, CURRENT_TIMESTAMP, 0, 0, 0, 0)
        `, [simulation.id]);

        logger.info(`Simulation created for resume ${resumeId} in ${countryCode}`);
        return simulation;
      });
    } catch (error) {
      logger.error('Error creating simulation:', error);
      throw error;
    }
  }

  // Calculate simulation parameters based on resume quality
  static calculateSimulationParameters(resume, totalEmployers) {
    const overallScore = resume.overall_score || 50;
    const qualityScore = resume.quality_score || 50;
    const skillMatch = resume.skill_match_percentage || 50;

    // Duration: Higher quality resumes get faster delivery (1-4 days)
    const minHours = parseInt(process.env.SIMULATION_MIN_HOURS) || 1;
    const maxHours = parseInt(process.env.SIMULATION_MAX_HOURS) || 96;
    
    // Better resumes get delivered faster
    const durationHours = Math.max(
      minHours,
      Math.round(maxHours - (overallScore / 100) * (maxHours - minHours))
    );

    // Calculate target opens (20-80% of employers based on quality)
    const openRate = Math.max(0.2, Math.min(0.8, (qualityScore + skillMatch) / 200 + 0.1));
    const targetOpens = Math.round(totalEmployers * openRate);

    // Calculate target shortlists (5-25% of opens based on overall score)
    const shortlistRate = Math.max(0.05, Math.min(0.25, overallScore / 400 + 0.05));
    const targetShortlists = Math.round(targetOpens * shortlistRate);

    const endTime = new Date();
    endTime.setHours(endTime.getHours() + durationHours);

    return {
      durationHours,
      targetOpens,
      targetShortlists,
      endTime
    };
  }

  // Update all active simulations
  static async updateAllActiveSimulations() {
    try {
      const result = await query(`
        SELECT * FROM resume_simulations 
        WHERE status = 'running' 
        AND simulation_end > CURRENT_TIMESTAMP
      `);

      const activeSimulations = result.rows;
      logger.info(`Updating ${activeSimulations.length} active simulations`);

      for (const simulation of activeSimulations) {
        await this.updateSimulation(simulation);
      }

      // Complete expired simulations
      await this.completeExpiredSimulations();

    } catch (error) {
      logger.error('Error updating simulations:', error);
    }
  }

  // Update a single simulation
  static async updateSimulation(simulation) {
    try {
      const now = new Date();
      const startTime = new Date(simulation.simulation_start);
      const endTime = new Date(simulation.simulation_end);
      
      // Calculate progress (0-1)
      const totalDuration = endTime.getTime() - startTime.getTime();
      const elapsed = now.getTime() - startTime.getTime();
      const progress = Math.min(elapsed / totalDuration, 1);

      // Calculate current values with some randomization
      const baseOpens = Math.floor(simulation.target_opens * progress);
      const baseShortlists = Math.floor(simulation.target_shortlists * progress);

      // Add some randomness to make it feel more realistic
      const randomFactor = 0.1; // 10% randomness
      const opensVariation = Math.floor(baseOpens * randomFactor * (Math.random() - 0.5));
      const shortlistsVariation = Math.floor(baseShortlists * randomFactor * (Math.random() - 0.5));

      const newOpens = Math.max(
        simulation.current_opens,
        Math.min(simulation.target_opens, baseOpens + opensVariation)
      );
      
      const newShortlists = Math.max(
        simulation.current_shortlists,
        Math.min(simulation.target_shortlists, baseShortlists + shortlistsVariation)
      );

      // Calculate employers reached (opens + some additional reach)
      const employersReached = Math.min(
        simulation.total_employers,
        Math.floor(newOpens * 1.2) // 20% more employers see it than open it
      );

      await transaction(async (client) => {
        // Update simulation
        await client.query(`
          UPDATE resume_simulations 
          SET current_opens = $1, current_shortlists = $2, last_updated = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [newOpens, newShortlists, simulation.id]);

        // Add dashboard metric entry
        await client.query(`
          INSERT INTO dashboard_metrics (
            simulation_id, timestamp, opens_count, shortlists_count,
            employers_reached, progress_percentage
          ) VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4, $5)
        `, [
          simulation.id,
          newOpens,
          newShortlists,
          employersReached,
          Math.round(progress * 100)
        ]);
      });

      logger.debug(`Updated simulation ${simulation.id}: ${newOpens} opens, ${newShortlists} shortlists`);

    } catch (error) {
      logger.error(`Error updating simulation ${simulation.id}:`, error);
    }
  }

  // Complete expired simulations
  static async completeExpiredSimulations() {
    try {
      const result = await query(`
        UPDATE resume_simulations 
        SET status = 'completed', 
            current_opens = target_opens,
            current_shortlists = target_shortlists,
            last_updated = CURRENT_TIMESTAMP
        WHERE status = 'running' 
        AND simulation_end <= CURRENT_TIMESTAMP
        RETURNING id
      `);

      if (result.rows.length > 0) {
        logger.info(`Completed ${result.rows.length} expired simulations`);
        
        // Add final dashboard metrics for completed simulations
        for (const row of result.rows) {
          const simulationData = await query(
            'SELECT * FROM resume_simulations WHERE id = $1',
            [row.id]
          );
          
          if (simulationData.rows.length > 0) {
            const sim = simulationData.rows[0];
            const employersReached = Math.min(
              sim.total_employers,
              Math.floor(sim.target_opens * 1.2)
            );

            await query(`
              INSERT INTO dashboard_metrics (
                simulation_id, timestamp, opens_count, shortlists_count,
                employers_reached, progress_percentage
              ) VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4, 100)
            `, [sim.id, sim.target_opens, sim.target_shortlists, employersReached]);
          }
        }
      }
    } catch (error) {
      logger.error('Error completing expired simulations:', error);
    }
  }

  // Get simulation status
  static async getSimulationStatus(resumeId, countryCode = null) {
    try {
      let queryText = `
        SELECT rs.*, dm.opens_count, dm.shortlists_count, dm.employers_reached, dm.progress_percentage
        FROM resume_simulations rs
        LEFT JOIN LATERAL (
          SELECT * FROM dashboard_metrics 
          WHERE simulation_id = rs.id 
          ORDER BY timestamp DESC 
          LIMIT 1
        ) dm ON true
        WHERE rs.resume_id = $1
      `;
      
      const params = [resumeId];
      
      if (countryCode) {
        queryText += ' AND rs.country_code = $2';
        params.push(countryCode);
      }
      
      queryText += ' ORDER BY rs.created_at DESC';

      const result = await query(queryText, params);
      return result.rows;
    } catch (error) {
      logger.error('Error getting simulation status:', error);
      throw error;
    }
  }

  // Get dashboard metrics history
  static async getDashboardMetrics(simulationId, limit = 50) {
    try {
      const result = await query(`
        SELECT * FROM dashboard_metrics 
        WHERE simulation_id = $1 
        ORDER BY timestamp DESC 
        LIMIT $2
      `, [simulationId, limit]);

      return result.rows.reverse(); // Return in chronological order
    } catch (error) {
      logger.error('Error getting dashboard metrics:', error);
      throw error;
    }
  }

  // Pause simulation
  static async pauseSimulation(simulationId) {
    try {
      await query(`
        UPDATE resume_simulations 
        SET status = 'paused', last_updated = CURRENT_TIMESTAMP
        WHERE id = $1 AND status = 'running'
      `, [simulationId]);

      logger.info(`Simulation ${simulationId} paused`);
    } catch (error) {
      logger.error('Error pausing simulation:', error);
      throw error;
    }
  }

  // Resume simulation
  static async resumeSimulation(simulationId) {
    try {
      await query(`
        UPDATE resume_simulations 
        SET status = 'running', last_updated = CURRENT_TIMESTAMP
        WHERE id = $1 AND status = 'paused'
      `, [simulationId]);

      logger.info(`Simulation ${simulationId} resumed`);
    } catch (error) {
      logger.error('Error resuming simulation:', error);
      throw error;
    }
  }

  // Get simulation statistics
  static async getSimulationStats() {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_simulations,
          COUNT(CASE WHEN status = 'running' THEN 1 END) as running_simulations,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_simulations,
          COUNT(CASE WHEN status = 'paused' THEN 1 END) as paused_simulations,
          AVG(current_opens) as avg_opens,
          AVG(current_shortlists) as avg_shortlists,
          AVG(duration_hours) as avg_duration_hours
        FROM resume_simulations
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      `);

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting simulation stats:', error);
      throw error;
    }
  }
}

module.exports = SimulationService;