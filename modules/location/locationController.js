const axios = require('axios');

const getLocationSuggestions = async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ message: 'Query parameter "q" is required.' });
  }

  try {
    const url = `https://us1.locationiq.com/v1/search?key=${process.env.LOCATIONIQ_API_KEY}&q=${encodeURIComponent(
      query
    )}&format=json&limit=5`;
    
    const response = await axios.get(url);

    const suggestions = response.data.map((item) => ({
      id: item.place_id,
      name: item.display_name,
      coordinates: [parseFloat(item.lon), parseFloat(item.lat)],
    }));
    
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch location suggestions.' });
  }
};

module.exports = { getLocationSuggestions };