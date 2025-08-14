// --- START OF FILE modules/partner-application/applicationController.js ---

const PartnerApplication = require('../../models/partnerApplicationModel');
const { getSignedUrlForUpload } = require('../services/s3Service');

const createApplication = async (req, res) => {
    try {
        const application = new PartnerApplication(req.body);
        await application.save();
        res.status(201).json({ message: 'Application submitted successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const getUploadUrl = async (req, res) => {
    try {
        const { fileName, fileType } = req.query;
        const { uploadUrl, fileUrl } = await getSignedUrlForUpload({ key: fileName, fileType });
        res.json({ uploadUrl, fileUrl });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

module.exports = { createApplication, getUploadUrl };

// --- END OF FILE modules/partner-application/applicationController.js ---