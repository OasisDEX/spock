// import { makeRawLogExtractors } from './rawEventDataExtractor';

// describe('makeRawLogExtractors', () => {
//   it('works with mixed address list with starting block', () => {
//     const def = [
//       '0x4a6bc4e803c62081ffebcc8d227b5a87a58f1f8f',
//       { address: '0x0511674a67192fe51e86fe55ed660eb4f995bdd6', startingBlock: 10 },
//     ];
//     const extractors = makeRawLogExtractors(def);

//     expect(extractors.length).toBe(2);
//     expect(extractors[0].name).toBe('raw_log_0x4a6bc4e803c62081ffebcc8d227b5a87a58f1f8f_extractor');
//     expect(extractors[0].startingBlock).toBe(undefined);
//     expect(extractors[1].name).toBe('raw_log_0x0511674a67192fe51e86fe55ed660eb4f995bdd6_extractor');
//     expect(extractors[1].startingBlock).toBe(10);
//   });
// });
