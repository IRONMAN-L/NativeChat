export default ({ config }) => {
    return {
        ...config,
        android: {
            ...config.android,
            // If the EAS secret exists, use its path. Otherwise, look in the local folder.
            googleServicesFile: process.env.GOOGLE_SERVICES_JSON || "./google-services.json"
        }
    };
};