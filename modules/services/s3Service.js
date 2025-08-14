// --- START OF FILE services/s3Service.js ---

const aws = require('aws-sdk');

const s3 = new aws.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
    signatureVersion: 'v4',
});

const getSignedUrlForUpload = async ({ key, fileType }) => {
    const s3Params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: `partner-documents/${Date.now()}-${key}`,
        Expires: 60 * 5, // 5 minutes
        ContentType: fileType,
    };
    
    const uploadUrl = await s3.getSignedUrlPromise('putObject', s3Params);
    const fileUrl = uploadUrl.split('?')[0];

    return { uploadUrl, fileUrl };
};

module.exports = { getSignedUrlForUpload };

// --- END OF FILE services/s3Service.js ---