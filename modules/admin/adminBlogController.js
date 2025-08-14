const BlogPost = require('../../models/blogPostModel');
const aws = require('aws-sdk');

const createPost = async (req, res) => {
    try {
        const { title, excerpt, content, author, category, imageUrl, featured } = req.body;
        const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
        
        const newPost = new BlogPost({
            title,
            slug,
            excerpt,
            content,
            author,
            category,
            imageUrl,
            featured,
        });

        const createdPost = await newPost.save();
        res.status(201).json(createdPost);
    } catch (error) {
        res.status(400).json({ message: 'Failed to create blog post', error: error.message });
    }
};

const updatePost = async (req, res) => {
    try {
        const { title, excerpt, content, author, category, imageUrl, featured } = req.body;
        const post = await BlogPost.findById(req.params.id);

        if (post) {
            post.title = title;
            post.slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
            post.excerpt = excerpt;
            post.content = content;
            post.author = author;
            post.category = category;
            post.imageUrl = imageUrl;
            post.featured = featured;

            const updatedPost = await post.save();
            res.json(updatedPost);
        } else {
            res.status(404).json({ message: 'Blog post not found' });
        }
    } catch (error) {
        res.status(400).json({ message: 'Failed to update blog post', error: error.message });
    }
};

const deletePost = async (req, res) => {
    try {
        const post = await BlogPost.findById(req.params.id);
        if (post) {
            await post.deleteOne();
            res.json({ message: 'Blog post removed' });
        } else {
            res.status(404).json({ message: 'Blog post not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const getAllPosts = async (req, res) => {
    try {
        const posts = await BlogPost.find({}).sort({ createdAt: -1 });
        res.json(posts);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const getPostById = async (req, res) => {
    try {
        const post = await BlogPost.findById(req.params.id);
        if (post) {
            res.json(post);
        } else {
            res.status(404).json({ message: 'Blog post not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const getUploadUrl = async (req, res) => {
    try {
        const s3 = new aws.S3({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION,
        });
        const { fileName, fileType } = req.query;
        const key = `blog-images/${Date.now()}-${fileName}`;
        const s3Params = {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: key,
            Expires: 60 * 5,
            ContentType: fileType,
        };
        const uploadUrl = await s3.getSignedUrlPromise('putObject', s3Params);
        const fileUrl = uploadUrl.split('?')[0];
        res.json({ uploadUrl, fileUrl });
    } catch (error) {
        res.status(500).json({ message: 'Failed to get signed URL', error: error.message });
    }
};

module.exports = {
    createPost,
    updatePost,
    deletePost,
    getAllPosts,
    getPostById,
    getUploadUrl,
};