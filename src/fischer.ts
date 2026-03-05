export const rows = 9;
export const cols = 201;

export const baseTable: number[][] = new Array(rows).fill(0).map(() => new Array(cols).fill(0));
for (let j = 0; j < cols; j++) baseTable[0][j] = 1;
for (let i = 0; i < rows; i++) baseTable[i][0] = 1;
for (let j = 1; j < cols; j++) baseTable[1][j] = j * 2 + 1;
for (let i = 2; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
        baseTable[i][j] = baseTable[i][j-1] + baseTable[i-1][j] + baseTable[i-1][j-1];
    }
}

export function fischerDecode(length: number, encoded_val: number, k: number): number[] {
    const out = new Array(length).fill(0);
    if (k === 0) return out;
    
    let current_val = 0;
    let out_idx = 0;
    let current_k = k;
    let n = length;
    
    while (out_idx < length) {
        if (encoded_val === current_val) break;
        if (current_k <= 0) break;
        if (n <= 0) break;
        
        let t_val = baseTable[n - 1][current_k];
        if (encoded_val < current_val + t_val) {
            out[out_idx] = 0;
        } else {
            t_val = baseTable[n - 1][current_k];
            let v = 1;
            current_val += t_val;
            
            while (true) {
                if (current_k - v < 0) break;
                t_val = baseTable[n - 1][current_k - v];
                if (encoded_val < current_val + t_val * 2) break;
                v++;
                current_val += t_val * 2;
            }
            
            if (current_k - v >= 0) {
                t_val = baseTable[n - 1][current_k - v];
                if (current_val <= encoded_val && encoded_val < current_val + t_val) {
                    out[out_idx] = v;
                } else {
                    if (current_val + t_val <= encoded_val) {
                        out[out_idx] = -v;
                        current_val += t_val;
                    }
                }
            }
        }
        n--;
        const written_val = out[out_idx];
        out_idx++;
        current_k -= Math.abs(written_val);
    }
    
    if (current_k > 0) {
        out[length - 1] += (out[length - 1] >= 0 ? current_k : -current_k);
    }
    return out;
}
