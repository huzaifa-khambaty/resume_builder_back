const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const logger = require("../config/logger");

// Configure AWS SDK
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

/**
 * Upload file to S3 bucket
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - Original file name
 * @param {string} mimeType - File MIME type
 * @param {string} folder - S3 folder path (optional)
 * @returns {Promise<Object>} - Upload result with S3 URL
 */
async function uploadFile(fileBuffer, fileName, mimeType, folder = "uploads") {
  try {
    const fileExtension = path.extname(fileName);
    const uniqueFileName = `${uuidv4()}${fileExtension}`;
    const key = folder ? `${folder}/${uniqueFileName}` : uniqueFileName;

    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
    };

    const result = await s3.upload(params).promise();

    logger?.info?.("File uploaded to S3", {
      key: result.Key,
      location: result.Location,
    });

    return {
      success: true,
      key: result.Key,
      bucket: result.Bucket,
    };
  } catch (error) {
    logger?.error?.("S3 upload error", { error: error.message });
    throw new Error(`Failed to upload file to S3: ${error.message}`);
  }
}

/**
 * Upload resume PDF to S3
 * @param {Buffer} fileBuffer - PDF file buffer
 * @param {string} fileName - Original file name
 * @param {string} candidateId - Candidate ID for folder organization
 * @returns {Promise<Object>} - Upload result with S3 URL
 */
async function uploadResume(fileBuffer, fileName, candidateId) {
  const folder = `resumes/${candidateId}`;
  return uploadFile(fileBuffer, fileName, "application/pdf", folder);
}

/**
 * Delete file from S3
 * @param {string} key - S3 object key
 * @returns {Promise<boolean>} - Success status
 */
async function deleteFile(key) {
  try {
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: key,
    };

    await s3.deleteObject(params).promise();

    logger?.info?.("File deleted from S3", { key });
    return true;
  } catch (error) {
    logger?.error?.("S3 delete error", { error: error.message, key });
    throw new Error(`Failed to delete file from S3: ${error.message}`);
  }
}

/**
 * Get signed URL for private file access
 * @param {string} key - S3 object key
 * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>} - Signed URL
 */
async function getSignedUrl(key, expiresIn = 3600) {
  try {
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Expires: expiresIn,
    };

    const url = await s3.getSignedUrlPromise("getObject", params);
    return url;
  } catch (error) {
    logger?.error?.("S3 signed URL error", { error: error.message, key });
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
}

/**
 * Check if file exists in S3
 * @param {string} key - S3 object key
 * @returns {Promise<boolean>} - File existence status
 */
async function fileExists(key) {
  try {
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: key,
    };

    await s3.headObject(params).promise();
    return true;
  } catch (error) {
    if (error.code === "NotFound") {
      return false;
    }
    throw error;
  }
}

/**
 * Get file metadata from S3
 * @param {string} key - S3 object key
 * @returns {Promise<Object>} - File metadata
 */
async function getFileMetadata(key) {
  try {
    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: key,
    };

    const result = await s3.headObject(params).promise();
    return {
      contentType: result.ContentType,
      contentLength: result.ContentLength,
      lastModified: result.LastModified,
      etag: result.ETag,
    };
  } catch (error) {
    logger?.error?.("S3 metadata error", { error: error.message, key });
    throw new Error(`Failed to get file metadata: ${error.message}`);
  }
}

/**
 * List files in S3 folder
 * @param {string} prefix - S3 folder prefix
 * @param {number} maxKeys - Maximum number of keys to return
 * @returns {Promise<Array>} - Array of file objects
 */
async function listFiles(prefix = "", maxKeys = 1000) {
  try {
    const params = {
      Bucket: process.env.S3_BUCKET,
      Prefix: prefix,
      MaxKeys: maxKeys,
    };

    const result = await s3.listObjectsV2(params).promise();
    return result.Contents || [];
  } catch (error) {
    logger?.error?.("S3 list files error", { error: error.message, prefix });
    throw new Error(`Failed to list files: ${error.message}`);
  }
}

/**
 * Generate S3 URL from key
 * @param {string} key - S3 object key
 * @returns {string} - S3 URL
 */
function generateUrlFromKey(key) {
  if (!key) return null;
  const bucketName = process.env.S3_BUCKET;
  const region = process.env.AWS_REGION;
  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * Extract S3 key from URL (legacy support)
 * @param {string} url - S3 URL
 * @returns {string|null} - S3 key or null if invalid URL
 */
function extractKeyFromUrl(url) {
  try {
    if (!url) return null;

    const bucketName = process.env.S3_BUCKET;
    const patterns = [
      new RegExp(`https://${bucketName}\\.s3\\.[^/]+\\.amazonaws\\.com/(.+)`),
      new RegExp(`https://s3\\.[^/]+\\.amazonaws\\.com/${bucketName}/(.+)`),
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return decodeURIComponent(match[1]);
      }
    }

    return null;
  } catch (error) {
    logger?.error?.("Extract key from URL error", {
      error: error.message,
      url,
    });
    return null;
  }
}

module.exports = {
  uploadFile,
  uploadResume,
  deleteFile,
  getSignedUrl,
  fileExists,
  getFileMetadata,
  listFiles,
  generateUrlFromKey,
  extractKeyFromUrl,
};
