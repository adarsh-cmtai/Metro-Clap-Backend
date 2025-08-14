const BlogPost = require('../../models/blogPostModel');

const getBlogPosts = async (req, res) => {
  try {
    const { category, search } = req.query;
    const query = { featured: false };

    if (category && category !== 'All') {
      query.category = category;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { title: searchRegex },
        { excerpt: searchRegex },
        { content: searchRegex },
      ];
    }

    const posts = await BlogPost.find(query).sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

const getFeaturedPost = async (req, res) => {
  try {
    const featuredPost = await BlogPost.findOne({ featured: true });
    res.json(featuredPost);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

const getBlogPostBySlug = async (req, res) => {
  try {
    const post = await BlogPost.findOne({ slug: req.params.slug });
    if (!post) {
      return res.status(404).json({ message: 'Blog post not found' });
    }
    res.json(post);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

const getBlogCategories = async (req, res) => {
  try {
    const categories = await BlogPost.distinct('category');
    res.json(['All', ...categories]);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

module.exports = {
  getBlogPosts,
  getFeaturedPost,
  getBlogPostBySlug,
  getBlogCategories,
};