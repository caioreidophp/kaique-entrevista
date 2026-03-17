export const transportFeatures = {
    operationsHub: (import.meta.env.VITE_TRANSPORT_FEATURE_OPERATIONS_HUB ?? '1') !== '0',
    csvExports: (import.meta.env.VITE_TRANSPORT_FEATURE_CSV_EXPORTS ?? '1') !== '0',
};
