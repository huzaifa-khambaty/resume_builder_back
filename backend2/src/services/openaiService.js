const OpenAI = require('openai');
const logger = require('../utils/logger');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class OpenAIService {
  static async generateResume(resumeData) {
    try {
      const { job_title, work_location, work_experiences, user_name } = resumeData;

      // Build work experience text
      const experienceText = work_experiences.map(exp => {
        const duration = exp.is_current 
          ? `${exp.start_date} - Present`
          : `${exp.start_date} - ${exp.end_date || 'Present'}`;
        
        const skills = exp.skills && exp.skills.length > 0 
          ? `\nSkills: ${exp.skills.join(', ')}`
          : '';
        
        const achievements = exp.achievements && exp.achievements.length > 0
          ? `\nAchievements: ${exp.achievements.join('; ')}`
          : '';

        return `${exp.job_title} at ${exp.company_name} (${duration})
${exp.description || ''}${skills}${achievements}`;
      }).join('\n\n');

      const prompt = `Create a professional resume for ${user_name || 'the candidate'} applying for a ${job_title} position in ${work_location}. 

Work Experience:
${experienceText}

Requirements:
- Write a compelling professional summary (3-4 sentences)
- Create detailed work experience descriptions that highlight achievements and impact
- Include relevant skills based on the job title and experience
- Add a professional education section (infer appropriate education based on the role)
- Include relevant certifications or additional qualifications if applicable
- Format the resume professionally with clear sections
- Ensure the content is 600+ words
- Use action verbs and quantify achievements where possible
- Tailor the content specifically for the ${job_title} role
- Make it ATS-friendly with proper formatting

Format the resume with clear section headers and professional formatting. Focus on achievements and impact rather than just job duties.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a professional resume writer with expertise in creating compelling, ATS-optimized resumes that highlight candidate achievements and align with job requirements. Always create resumes that are at least 600 words and focus on quantifiable achievements."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.7
      });

      const resumeContent = completion.choices[0].message.content;
      
      // Calculate metrics
      const wordCount = resumeContent.split(/\s+/).length;
      const qualityScore = this.calculateQualityScore(resumeContent, resumeData);
      const skillMatchPercentage = this.calculateSkillMatch(resumeContent, job_title);
      const completenessScore = this.calculateCompletenessScore(resumeData);

      logger.info(`Resume generated successfully. Word count: ${wordCount}`);

      return {
        content: resumeContent,
        word_count: wordCount,
        quality_score: qualityScore,
        skill_match_percentage: skillMatchPercentage,
        completeness_score: completenessScore,
        overall_score: this.calculateOverallScore(qualityScore, skillMatchPercentage, completenessScore)
      };

    } catch (error) {
      logger.error('Error generating resume with OpenAI:', error);
      throw new Error('Failed to generate resume content');
    }
  }

  static calculateQualityScore(content, resumeData) {
    let score = 0;
    
    // Base score for content length
    const wordCount = content.split(/\s+/).length;
    if (wordCount >= 600) score += 30;
    else if (wordCount >= 400) score += 20;
    else if (wordCount >= 200) score += 10;

    // Check for professional sections
    const sections = ['summary', 'experience', 'skills', 'education'];
    sections.forEach(section => {
      if (content.toLowerCase().includes(section)) {
        score += 10;
      }
    });

    // Check for action verbs
    const actionVerbs = ['achieved', 'managed', 'led', 'developed', 'implemented', 'improved', 'increased', 'reduced', 'created', 'designed'];
    const actionVerbCount = actionVerbs.filter(verb => 
      content.toLowerCase().includes(verb)
    ).length;
    score += Math.min(actionVerbCount * 2, 20);

    // Check for quantifiable achievements (numbers/percentages)
    const numberMatches = content.match(/\d+%|\$\d+|\d+\+/g);
    if (numberMatches) {
      score += Math.min(numberMatches.length * 3, 15);
    }

    return Math.min(score, 100);
  }

  static calculateSkillMatch(content, jobTitle) {
    // Define skill keywords for different job categories
    const skillKeywords = {
      'software': ['javascript', 'python', 'java', 'react', 'node', 'sql', 'git', 'api', 'database', 'cloud'],
      'marketing': ['seo', 'social media', 'analytics', 'campaign', 'brand', 'content', 'digital', 'strategy'],
      'sales': ['crm', 'lead generation', 'negotiation', 'client', 'revenue', 'pipeline', 'relationship'],
      'finance': ['excel', 'financial analysis', 'budgeting', 'forecasting', 'accounting', 'compliance'],
      'management': ['leadership', 'team', 'strategy', 'planning', 'budget', 'operations', 'process improvement'],
      'design': ['photoshop', 'illustrator', 'ui/ux', 'creative', 'visual', 'branding', 'typography'],
      'healthcare': ['patient care', 'medical', 'clinical', 'healthcare', 'treatment', 'diagnosis'],
      'education': ['curriculum', 'teaching', 'student', 'learning', 'assessment', 'classroom']
    };

    const contentLower = content.toLowerCase();
    const jobTitleLower = jobTitle.toLowerCase();
    
    // Determine job category
    let relevantSkills = [];
    Object.keys(skillKeywords).forEach(category => {
      if (jobTitleLower.includes(category) || 
          skillKeywords[category].some(skill => jobTitleLower.includes(skill))) {
        relevantSkills = [...relevantSkills, ...skillKeywords[category]];
      }
    });

    if (relevantSkills.length === 0) {
      // Default to general professional skills
      relevantSkills = ['communication', 'leadership', 'problem solving', 'teamwork', 'project management'];
    }

    const matchedSkills = relevantSkills.filter(skill => 
      contentLower.includes(skill)
    );

    return Math.min((matchedSkills.length / relevantSkills.length) * 100, 100);
  }

  static calculateCompletenessScore(resumeData) {
    let score = 0;
    const maxScore = 100;

    // Check required fields
    if (resumeData.job_title) score += 20;
    if (resumeData.work_location) score += 10;
    if (resumeData.work_experiences && resumeData.work_experiences.length > 0) score += 30;

    // Check work experience quality
    if (resumeData.work_experiences) {
      const totalExperiences = resumeData.work_experiences.length;
      let experienceScore = 0;

      resumeData.work_experiences.forEach(exp => {
        if (exp.company_name) experienceScore += 5;
        if (exp.job_title) experienceScore += 5;
        if (exp.start_date) experienceScore += 5;
        if (exp.description && exp.description.length > 50) experienceScore += 10;
        if (exp.skills && exp.skills.length > 0) experienceScore += 5;
        if (exp.achievements && exp.achievements.length > 0) experienceScore += 10;
      });

      score += Math.min(experienceScore, 40);
    }

    return Math.min(score, maxScore);
  }

  static calculateOverallScore(qualityScore, skillMatchPercentage, completenessScore) {
    // Weighted average: Quality 40%, Skill Match 35%, Completeness 25%
    return Math.round(
      (qualityScore * 0.4) + 
      (skillMatchPercentage * 0.35) + 
      (completenessScore * 0.25)
    );
  }

  static async generateJobSuggestions(userProfile, currentJobTitle) {
    try {
      const prompt = `Based on a candidate's profile, suggest 5 related job titles they might be interested in:

Current Job Title: ${currentJobTitle}
Location: ${userProfile.work_location || 'Not specified'}
Experience Level: Based on their background

Provide 5 job title suggestions that are:
1. Related to their current role
2. Potential career progression opportunities
3. Lateral moves in similar fields
4. Emerging roles in their industry
5. Remote-friendly positions

Format as a simple list of job titles only, one per line.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a career advisor providing job title suggestions based on candidate profiles."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.7
      });

      const suggestions = completion.choices[0].message.content
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .slice(0, 5);

      return suggestions;

    } catch (error) {
      logger.error('Error generating job suggestions:', error);
      return [];
    }
  }

  static async improveResumeContent(currentContent, feedback) {
    try {
      const prompt = `Improve the following resume content based on the feedback provided:

Current Resume Content:
${currentContent}

Feedback/Improvement Areas:
${feedback}

Please provide an improved version that addresses the feedback while maintaining professional quality and ATS optimization.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a professional resume writer focused on improving resume content based on specific feedback."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.7
      });

      return completion.choices[0].message.content;

    } catch (error) {
      logger.error('Error improving resume content:', error);
      throw new Error('Failed to improve resume content');
    }
  }
}

module.exports = OpenAIService;