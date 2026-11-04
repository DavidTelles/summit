export class Grid {
    constructor(w, h) {
        this.w = w;
        this.h = h;
        this.cells = Array.from({ length: h }, () => Array(w).fill('.'));
    }

    set(x, y, c) {
        if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.cells[y][x] = c;
        return this;
    }

    fill(x1, y1, x2, y2, c) {
        for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) this.set(x, y, c);
        return this;
    }

    many(list, c) {
        list.forEach(([x, y]) => this.set(x, y, c));
        return this;
    }

    secretRoom(doorX, y, roomX1, roomX2, height) {
        const dir = roomX1 > doorX ? 1 : -1;
        const left = Math.min(roomX1, roomX2) - (dir < 0 ? 1 : 0);
        const right = Math.max(roomX1, roomX2) + (dir > 0 ? 1 : 0);
        this.fill(left, y - 2, right, y - 1, '#');
        this.fill(left, y + height, right, y + height + 1, '#');
        this.fill(dir > 0 ? right : left, y, dir > 0 ? right : left, y + height - 1, '#');
        this.fill(Math.min(roomX1, roomX2), y, Math.max(roomX1, roomX2), y + height - 1, '.');
        this.fill(doorX, y, doorX, y + height - 1, 'X');
        return this;
    }
}
