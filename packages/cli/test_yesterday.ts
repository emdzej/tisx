import { decodeItwV1 } from './src/decompressors/itw-v1-idwt';
import * as fs from 'fs';
import { PNG } from 'pngjs';

try {
    const { width, height, data } = decodeItwV1('/Users/emdzej/Documents/tis/GRAFIK/1/03/95/26.ITW');
    const png = new PNG({ width, height, colorType: 0 });
    
    for(let i=0; i<data.length; i++) {
        png.data[i*4] = data[i];
        png.data[i*4+1] = data[i];
        png.data[i*4+2] = data[i];
        png.data[i*4+3] = 255;
    }
    
    png.pack().pipe(fs.createWriteStream('/Users/emdzej/Documents/itw/ITW_YESTERDAY_VERIFY.png'));
    console.log("Successfully verified yesterday's code and saved to ITW_YESTERDAY_VERIFY.png");
} catch (e) {
    console.error("Error running yesterday's code:", e);
}
