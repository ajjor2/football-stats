import { createStatItemHtml } from '../js/utils.js';

describe('DOM Utility Functions', () => {
    describe('createStatItemHtml', () => {
        test('should create basic stat item', () => {
            const html = createStatItemHtml('Label', 'Value');
            expect(html).toContain('<p class="font-medium text-gray-700">Label:</p><p class="text-gray-600">Value</p>');
        });

        test('should return empty string for null, N/A, or undefined values', () => {
            expect(createStatItemHtml('Label', null)).toBe('');
            expect(createStatItemHtml('Label', 'N/A')).toBe('');
            expect(createStatItemHtml('Label', undefined)).toBe('');
            expect(createStatItemHtml('Label', '')).toBe('');
        });

        test('should return empty string for date string "0000-00-00"', () => {
            expect(createStatItemHtml('Label', '0000-00-00')).toBe('');
        });

        test('should use custom container classes if provided', () => {
            const html = createStatItemHtml('Label', 'Value', 'custom-class');
            expect(html).toContain('class="custom-class"');
            expect(html).toContain('Label:');
            expect(html).toContain('Value');
        });
    });
});
