const Service = require('../../models/serviceModel');
const Category = require('../../models/categoryModel');
const Booking = require('../../models/bookingModel');
const Review = require('../../models/reviewModel');
const mongoose = require('mongoose');

const getHomepageReviews = async (req, res) => {
    try {
        const reviews = await Review.find({ isApproved: true })
            .sort({ rating: -1, createdAt: -1 })
            .limit(3)
            .populate('customerId', 'name avatarUrl')
            .populate('serviceId', 'name');
        
        res.json(reviews);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const getFeaturedServices = async (req, res) => {
    try {
        const topServiceIds = await Booking.aggregate([
            { $unwind: '$items' },
            { $group: { _id: '$items.serviceId', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 4 },
            { $project: { _id: 1 } }
        ]);

        const serviceIds = topServiceIds.map(s => s._id);

        const services = await Service.aggregate([
            { $match: { _id: { $in: serviceIds } } },
            {
                $lookup: {
                    from: 'subservices',
                    localField: '_id',
                    foreignField: 'serviceId',
                    as: 'subServices'
                }
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            {
                $unwind: '$category'
            }
        ]);

        res.json(services);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const getAllServices = async (req, res) => {
    try {
        const services = await Service.aggregate([
            { $match: { isActive: true } },
            {
                $lookup: {
                    from: 'subservices',
                    localField: '_id',
                    foreignField: 'serviceId',
                    as: 'subServices'
                }
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'category',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            {
                $unwind: '$category'
            }
        ]);
        res.json(services);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const getServiceCategories = async (req, res) => {
    try {
        const categories = await Service.distinct('category');
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: "Server Error" });
    }
};

const getServicesByCategory = async (req, res) => {
    try {
        const { locationId } = req.query;
        const matchStage = {};

        if (locationId) {
            matchStage.locationId = new mongoose.Types.ObjectId(locationId);
        }
        
        const categoriesWithServices = await Category.aggregate([
            { $match: matchStage },
            {
                $lookup: {
                    from: 'services',
                    let: { categoryId: '$_id' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$category', '$$categoryId'] } } },
                        {
                            $lookup: {
                                from: 'subservices',
                                localField: '_id',
                                foreignField: 'serviceId',
                                as: 'subServices'
                            }
                        }
                    ],
                    as: 'services'
                }
            }
        ]);
        
        res.json(categoriesWithServices);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const getServiceBySlug = async (req, res) => {
    try {
        const serviceData = await Service.aggregate([
            { $match: { slug: req.params.slug } },
            {
                $lookup: {
                    from: 'subservices',
                    localField: '_id',
                    foreignField: 'serviceId',
                    as: 'subServices'
                }
            }
        ]);

        if (!serviceData || serviceData.length === 0) {
            return res.status(404).json({ message: 'Service not found.' });
        }
        res.json(serviceData[0]);
    } catch (error) {
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};


module.exports = { getAllServices, getServiceCategories, getServicesByCategory, getServiceBySlug, getFeaturedServices, getHomepageReviews };