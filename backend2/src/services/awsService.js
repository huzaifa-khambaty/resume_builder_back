const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// Configure AWS
AWS.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

// Initialize AWS services
const s3 = new AWS.S3();
const ses = new AWS.SES({ region: process.env.AWS_SES_REGION });
const cognito = new AWS.CognitoIdentityServiceProvider({
  region: process.env.AWS_COGNITO_REGION
});

class AWSService {
  // S3 Operations
  static async generateSignedUploadUrl(userId, fileType = 'pdf') {
    try {
      const key = `resumes/${userId}/${uuidv4()}.${fileType}`;
      const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
        Expires: 300, // 5 minutes
        ContentType: `application/${fileType}`,
        ACL: 'private'
      };

      const uploadUrl = await s3.getSignedUrlPromise('putObject', params);
      const downloadUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

      return {
        uploadUrl,
        downloadUrl,
        key
      };
    } catch (error) {
      logger.error('Error generating signed URL:', error);
      throw error;
    }
  }

  static async generateSignedDownloadUrl(key, expiresIn = 3600) {
    try {
      const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
        Expires: expiresIn
      };

      const downloadUrl = await s3.getSignedUrlPromise('getObject', params);
      return downloadUrl;
    } catch (error) {
      logger.error('Error generating download URL:', error);
      throw error;
    }
  }

  static async uploadToS3(key, buffer, contentType) {
    try {
      const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: 'private'
      };

      const result = await s3.upload(params).promise();
      return result.Location;
    } catch (error) {
      logger.error('Error uploading to S3:', error);
      throw error;
    }
  }

  static async deleteFromS3(key) {
    try {
      const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key
      };

      await s3.deleteObject(params).promise();
      logger.info(`Deleted S3 object: ${key}`);
    } catch (error) {
      logger.error('Error deleting from S3:', error);
      throw error;
    }
  }

  // SES Operations
  static async sendEmail(to, subject, htmlContent, textContent = null) {
    try {
      const params = {
        Source: process.env.FROM_EMAIL,
        Destination: {
          ToAddresses: Array.isArray(to) ? to : [to]
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: htmlContent,
              Charset: 'UTF-8'
            }
          }
        }
      };

      if (textContent) {
        params.Message.Body.Text = {
          Data: textContent,
          Charset: 'UTF-8'
        };
      }

      const result = await ses.sendEmail(params).promise();
      logger.info(`Email sent successfully: ${result.MessageId}`);
      return result.MessageId;
    } catch (error) {
      logger.error('Error sending email:', error);
      throw error;
    }
  }

  static async sendTemplatedEmail(to, templateName, templateData) {
    try {
      const params = {
        Source: process.env.FROM_EMAIL,
        Destination: {
          ToAddresses: Array.isArray(to) ? to : [to]
        },
        Template: templateName,
        TemplateData: JSON.stringify(templateData)
      };

      const result = await ses.sendTemplatedEmail(params).promise();
      logger.info(`Templated email sent successfully: ${result.MessageId}`);
      return result.MessageId;
    } catch (error) {
      logger.error('Error sending templated email:', error);
      throw error;
    }
  }

  // Cognito Operations
  static async getUserFromCognito(accessToken) {
    try {
      const params = {
        AccessToken: accessToken
      };

      const result = await cognito.getUser(params).promise();
      return result;
    } catch (error) {
      logger.error('Error getting user from Cognito:', error);
      throw error;
    }
  }

  static async adminGetUser(username) {
    try {
      const params = {
        UserPoolId: process.env.AWS_COGNITO_USER_POOL_ID,
        Username: username
      };

      const result = await cognito.adminGetUser(params).promise();
      return result;
    } catch (error) {
      logger.error('Error getting user from Cognito (admin):', error);
      throw error;
    }
  }

  static async adminUpdateUserAttributes(username, attributes) {
    try {
      const params = {
        UserPoolId: process.env.AWS_COGNITO_USER_POOL_ID,
        Username: username,
        UserAttributes: attributes
      };

      const result = await cognito.adminUpdateUserAttributes(params).promise();
      logger.info(`Updated user attributes for: ${username}`);
      return result;
    } catch (error) {
      logger.error('Error updating user attributes:', error);
      throw error;
    }
  }

  static async adminDisableUser(username) {
    try {
      const params = {
        UserPoolId: process.env.AWS_COGNITO_USER_POOL_ID,
        Username: username
      };

      const result = await cognito.adminDisableUser(params).promise();
      logger.info(`Disabled user: ${username}`);
      return result;
    } catch (error) {
      logger.error('Error disabling user:', error);
      throw error;
    }
  }

  static async adminEnableUser(username) {
    try {
      const params = {
        UserPoolId: process.env.AWS_COGNITO_USER_POOL_ID,
        Username: username
      };

      const result = await cognito.adminEnableUser(params).promise();
      logger.info(`Enabled user: ${username}`);
      return result;
    } catch (error) {
      logger.error('Error enabling user:', error);
      throw error;
    }
  }

  // CloudWatch Operations (for logging)
  static async putMetricData(namespace, metricData) {
    try {
      const cloudwatch = new AWS.CloudWatch();
      const params = {
        Namespace: namespace,
        MetricData: metricData
      };

      const result = await cloudwatch.putMetricData(params).promise();
      logger.debug('Metric data sent to CloudWatch');
      return result;
    } catch (error) {
      logger.error('Error sending metric data to CloudWatch:', error);
      throw error;
    }
  }

  // Utility method to check AWS service health
  static async checkAWSHealth() {
    const health = {
      s3: false,
      ses: false,
      cognito: false
    };

    try {
      // Check S3
      await s3.headBucket({ Bucket: process.env.AWS_S3_BUCKET }).promise();
      health.s3 = true;
    } catch (error) {
      logger.error('S3 health check failed:', error.message);
    }

    try {
      // Check SES
      await ses.getSendQuota().promise();
      health.ses = true;
    } catch (error) {
      logger.error('SES health check failed:', error.message);
    }

    try {
      // Check Cognito
      await cognito.describeUserPool({
        UserPoolId: process.env.AWS_COGNITO_USER_POOL_ID
      }).promise();
      health.cognito = true;
    } catch (error) {
      logger.error('Cognito health check failed:', error.message);
    }

    return health;
  }
}

module.exports = AWSService;