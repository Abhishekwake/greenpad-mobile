const cloudinary = require('../config/cloudinary');

const VIDEO_PUBLIC_IDS = [
  'CompleteInstallationVideo_nwgnj9',
  'Residenttial_tfzpo6',
  'InstalltationMontage_ezjsui',
  'CommercialOxygenPark_npbjep',
];

const VIDEO_METADATA = {
  'CompleteInstallationVideo_nwgnj9': {
    title: 'Complete Installation Guide',
    duration: '3:15',
    location: 'Wardha, Maharashtra',
    type: 'horizontal',
    description: 'Full walkthrough of a 5kW residential installation',
  },
  'Residenttial_tfzpo6': {
    title: 'Residential Solar Setup',
    duration: '2:30',
    location: 'Wardha, Maharashtra',
    type: 'vertical',
    description: 'Modern home with rooftop solar panels',
  },
  'InstalltationMontage_ezjsui': {
    title: 'Behind The Scenes: Solar Installation',
    duration: '1:45',
    location: 'Wardha, Maharashtra',
    type: 'vertical',
    description: 'Expert team installing premium solar panels',
  },
  'CommercialOxygenPark_npbjep': {
    title: 'Commercial Project: Oxygen Park',
    duration: '4:00',
    location: 'Wardha, Maharashtra',
    type: 'horizontal',
    aspectRatio: 'fit',
    description: 'Large-scale 50kW commercial installation',
  },
};

exports.getVideos = async (req, res, next) => {
  try {
    const videos = VIDEO_PUBLIC_IDS.map((publicId) => {
      const metadata = VIDEO_METADATA[publicId] || {
        title: publicId,
        duration: '0:00',
        location: 'Wardha, Maharashtra',
        type: 'horizontal',
        description: '',
      };

      // Use 'limit' for horizontal videos to fit without cropping
      const cropMode = metadata.aspectRatio === 'fit' ? 'limit' : 'scale';
      
      const url = cloudinary.url(publicId, {
        resource_type: 'video',
        quality: 'auto',
        fetch_format: 'auto',
        width: 720,
        crop: cropMode,
      });

      const thumbnail = cloudinary.url(publicId, {
        resource_type: 'video',
        format: 'jpg',
        width: 400,
        height: 225,
        crop: 'fill',
        gravity: 'auto',
        start_offset: '2',
      });

      return {
        id: publicId,
        title: metadata.title,
        duration: metadata.duration,
        location: metadata.location,
        type: metadata.type,
        description: metadata.description,
        url,
        thumbnail,
      };
    });

    res.json({ success: true, videos });
  } catch (error) {
    next(error);
  }
};
