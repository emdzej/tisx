import { decodeItwV1 } from './src/decompressors/itw-v1-idwt';
import * as fs from 'fs';
import { PNG } from 'pngjs';

const decoded = decodeItwV1('/Users/emdzej/Documents/tis/GRAFIK/1/03/95/26.ITW');

const png = new PNG({ width: decoded.width, height: decoded.height, colorType: 0 });
for (let y = 0; y < decoded.height; y++) {
    for (let x = 0; x < decoded.width; x++) {
        const v = decoded.data[y * decoded.width + x];
        const idx = (y * decoded.width + x) * 4;
        png.data[idx] = v;
        png.data[idx+1] = v;
        png.data[idx+2] = v;
        png.data[idx+3] = 255;
    }
}

png.pack().pipe(fs.createWriteStream('/Users/emdzej/Documents/itw/ITW_POLYPHASE_V2.png'));
console.log("Wrote ITW_POLYPHASE_V2.png");
