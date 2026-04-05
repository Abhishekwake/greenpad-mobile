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
    location: 'Pune, Maharashtra',
    type: 'horizontal',
    description: 'Full walkthrough of a 5kW residential installation',
  },
  'Residenttial_tfzpo6': {
    title: 'Residential Solar Setup',
    duration: '2:30',
    location: 'Mumbai, Maharashtra',
    type: 'vertical',
    description: 'Modern home with rooftop solar panels',
  },
  'InstalltationMontage_ezjsui': {
    title: 'Installation Montage',
    duration: '1:45',
    location: 'Nashik, Maharashtra',
    type: 'vertical',
    description: 'Quick highlights of our installation process',
  },
  'CommercialOxygenPark_npbjep': {
    title: 'Commercial: Oxygen Park',
    duration: '4:00',
    location: 'Nagpur, Maharashtra',
    type: 'horizontal',
    description: 'Large-scale commercial installation at Oxygen Park',
  },
};

exports.getVideos = async (req, res, next) => {
  try {
    const videos = VIDEO_PUBLIC_IDS.map((publicId) => {
      const url = cloudinary.url(publicId, {
        resource_type: 'video',
        quality: 'auto',
        fetch_format: 'auto',
        width: 720,
        crop: 'scale',
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

      const metadata = VIDEO_METADATA[publicId] || {
        title: publicId,
        duration: '0:00',
        location: 'India',
        type: 'horizontal',
        description: '',
      };

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
