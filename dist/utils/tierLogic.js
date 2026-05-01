"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTierConfig = void 0;
const getTierConfig = (tier) => {
    switch (tier) {
        case 'TIER_3':
            return { feePercent: 0.035, pdfLimit: 120, label: 'Tier 3 (Premium)' };
        case 'TIER_2':
            return { feePercent: 0.05, pdfLimit: 80, label: 'Tier 2 (Pro)' };
        case 'TIER_1':
            return { feePercent: 0.10, pdfLimit: 50, label: 'Tier 1 (Starter)' };
        case 'TRIAL':
            // 48-Hour Trial gets Tier 3 features to build maximum curiosity
            return { feePercent: 0.035, pdfLimit: 120, label: '48-Hour Trial Access' };
        default:
            return { feePercent: 0.20, pdfLimit: 0, label: 'Inactive / Locked' };
    }
};
exports.getTierConfig = getTierConfig;
