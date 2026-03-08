// core.js - ПОЛНАЯ ВЕРСИЯ С ГРУППИРОВКОЙ В ОБЪЕКТ

const Drawing = {
    // Основные переменные
    svg: document.getElementById("canvas"),
    GRID_SNAP_MM: 10,
    LIGHT_SNAP_MM: 50,
    MM_TO_PX: 3.78,

    scale: 0.18,
    offsetX: 100,
    offsetY: 100,
    rooms: [],
    activeRoom: 0,
    dragId: null,
    dragElem: null,
    isPanning: false,
    startPanX: 0,
    startPanY: 0,
    mousePos: { x: 0, y: 0, shift: false },
    isHoveringFirstPoint: false,
    currentTool: 'draw',
    showDiagonals: true,
    showMeasures: true,
    history: [],
    selectedPointId: null,
    skipRoomTypeModal: false,

    // ========== ОСНОВНЫЕ ФУНКЦИИ ==========

    saveState: function() {
        if (this.history.length > 50) this.history.shift();
        this.history.push(JSON.stringify(this.rooms));
    },

    undo: function() {
        if (this.history.length > 0) {
            this.rooms = JSON.parse(this.history.pop());
            if (this.activeRoom >= this.rooms.length) this.activeRoom = Math.max(0, this.rooms.length - 1);
            this.renderTabs();
            this.draw();
        }
    },

    setTool: function(tool) {
        this.currentTool = (this.currentTool === tool) ? 'draw' : tool;
        document.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById('tool-' + tool);
        if (btn && this.currentTool !== 'draw') btn.classList.add('active');
    },

    toggleDiagonals: function() {
        this.showDiagonals = !this.showDiagonals;
        document.getElementById("toggleDiags").classList.toggle("btn-toggle-active", this.showDiagonals);
        this.draw();
    },

    toggleMeasures: function() {
        this.showMeasures = !this.showMeasures;
        document.getElementById("toggleMeasures").classList.toggle("btn-toggle-active", this.showMeasures);
        this.draw();
    },

    renameRoom: function() {
        let r = this.rooms[this.activeRoom];
        let newName = prompt("Введите название помещения:", r.name);
        if (newName) {
            this.saveState();
            r.name = newName;
            this.renderTabs();
            this.updateStats();
        }
    },

    mmToPx: function(mm, axis) {
        return axis === 'x' ? (mm * this.MM_TO_PX * this.scale) + this.offsetX : (mm * this.MM_TO_PX * this.scale) + this.offsetY;
    },

    pxToMm: function(px, axis) {
        return axis === 'x' ? (px - this.offsetX) / (this.MM_TO_PX * this.scale) : (px - this.offsetY) / (this.MM_TO_PX * this.scale);
    },

    snap: function(mm, firstMm = null, step = 10) {
        if (firstMm !== null && Math.abs(mm - firstMm) < 50) return firstMm;
        return Math.round(mm / step) * step;
    },

    getSnappedPos: function(mx, my, currentEl = null) {
        let r = this.rooms[this.activeRoom];
        let fx = this.snap(mx, null, this.LIGHT_SNAP_MM);
        let fy = this.snap(my, null, this.LIGHT_SNAP_MM);
        if (r.elements) {
            r.elements.forEach(el => {
                if (el === currentEl) return;
                if (Math.abs(fx - el.x) < 80) fx = el.x;
                if (Math.abs(fy - el.y) < 80) fy = el.y;
            });
        }
        return { x: fx, y: fy };
    },

    drawGrid: function() {
        const s100 = 100 * this.MM_TO_PX * this.scale; 
        if (s100 > 5) {
            for (let x = this.offsetX % s100; x < this.svg.clientWidth; x += s100) {
                this.svg.appendChild(this.createLine(x, 0, x, this.svg.clientHeight, "#f1f1f1", 0.5));
            }
            for (let y = this.offsetY % s100; y < this.svg.clientHeight; y += s100) {
                this.svg.appendChild(this.createLine(0, y, this.svg.clientWidth, y, "#f1f1f1", 0.5));
            }
        }
    },

    createLine: function(x1, y1, x2, y2, c, w, d) {
        let l = document.createElementNS("http://www.w3.org/2000/svg", "line");
        l.setAttribute("x1", x1);
        l.setAttribute("y1", y1);
        l.setAttribute("x2", x2);
        l.setAttribute("y2", y2);
        l.setAttribute("stroke", c);
        l.setAttribute("stroke-width", w);
        if (d) l.setAttribute("stroke-dasharray", d);
        return l;
    },

    renderText: function(x, y, txt, cls) {
        let t = document.createElementNS("http://www.w3.org/2000/svg", "text");
        t.setAttribute("x", x);
        t.setAttribute("y", y);
        t.setAttribute("class", cls);
        t.textContent = txt;
        this.svg.appendChild(t);
        return t;
    },

    // ========== ПОЛНАЯ ФУНКЦИЯ DRAW ==========

    draw: function(isExport = false) {
        this.updateZoomLevel();
        this.svg.innerHTML = "";
        if (!isExport) this.drawGrid();
        
        let r = this.rooms[this.activeRoom];
        if (!r) return;
        
        if (r.closed && r.points.length > 3 && this.showDiagonals) {
            for (let i = 0; i < r.points.length; i++) {
                for (let j = i + 2; j < r.points.length; j++) {
                    if (i === 0 && j === r.points.length - 1) continue;
                    let p1 = r.points[i], p2 = r.points[j];
                    this.svg.appendChild(this.createLine(
                        this.mmToPx(p1.x, 'x'), this.mmToPx(p1.y, 'y'), 
                        this.mmToPx(p2.x, 'x'), this.mmToPx(p2.y, 'y'), 
                        "rgba(142, 68, 173, 0.15)", 1, "4,4"
                    ));
                    let d = Math.round(Math.sqrt((p2.x-p1.x)**2 + (p2.y-p1.y)**2)/10);
                    this.renderText(
                        this.mmToPx((p1.x+p2.x)/2, 'x'), 
                        this.mmToPx((p1.y+p2.y)/2, 'y'), 
                        d, "diag-label"
                    );
                }
            }
        }
        
        if (r.points.length > 0) {
            let pts = r.points.map(p => `${this.mmToPx(p.x, 'x')},${this.mmToPx(p.y, 'y')}`).join(" ");
            let poly = document.createElementNS("http://www.w3.org/2000/svg", r.closed ? "polygon" : "polyline");
            poly.setAttribute("points", pts);
            poly.setAttribute("fill", r.closed ? "rgba(0,188,212,0.05)" : "none");
            poly.setAttribute("stroke", "#2c3e50");
            poly.setAttribute("stroke-width", 2.5);
            this.svg.appendChild(poly);
            
            r.points.forEach((p, i) => {
                if (!r.closed && i === r.points.length - 1) return;
                let pNext = r.points[(i + 1) % r.points.length];
                let d = Math.round(Math.sqrt((pNext.x-p.x)**2 + (pNext.y-p.y)**2)/10);
                if (d > 0) {
                    let txt = this.renderText(
                        this.mmToPx((p.x+pNext.x)/2, 'x'), 
                        this.mmToPx((p.y+pNext.y)/2, 'y'), 
                        d + " см", "length-label"
                    );
                    if (!isExport && window.isMobile) {
                        txt.addEventListener('touchstart', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.Mobile.openWallResize(i);
                        }, { passive: false });
                    } else if (!isExport) {
                        txt.onclick = () => this.resizeWall(i);
                    }
                }
            });
        }
        
        // Умный луч для десктопа
        if (r.points.length > 0 && !r.closed && !this.dragId && !this.dragElem && !isExport && this.currentTool === 'draw' && !window.isMobile) {
            let last = r.points[r.points.length - 1];
            let first = r.points[0];
            let rawX = this.pxToMm(this.mousePos.x, 'x');
            let rawY = this.pxToMm(this.mousePos.y, 'y');
            let sX = this.snap(rawX, first ? first.x : null);
            let sY = this.snap(rawY, first ? first.y : null);
            
            if (!this.mousePos.shift) {
                if (Math.abs(sX - last.x) > Math.abs(sY - last.y)) {
                    sY = last.y;
                } else {
                    sX = last.x;
                }
            }
            
            this.isHoveringFirstPoint = (r.points.length >= 3 && first && 
                Math.sqrt((this.mousePos.x - this.mmToPx(first.x, 'x'))**2 + 
                          (this.mousePos.y - this.mmToPx(first.y, 'y'))**2) < 25);
            
            this.svg.appendChild(this.createLine(
                this.mmToPx(last.x, 'x'), this.mmToPx(last.y, 'y'),
                this.mmToPx(sX, 'x'), this.mmToPx(sY, 'y'),
                this.isHoveringFirstPoint ? "var(--success)" : "var(--primary)",
                2, "6,4"
            ));
            
            if (first && (Math.abs(sX - first.x) < 2 || Math.abs(sY - first.y) < 2)) {
                this.svg.appendChild(this.createLine(
                    this.mmToPx(first.x, 'x'), this.mmToPx(first.y, 'y'),
                    this.mmToPx(sX, 'x'), this.mmToPx(sY, 'y'),
                    "#bbb", 1, "4,4"
                ));
            }
            
            let dist = Math.round(Math.sqrt((sX - last.x)**2 + (sY - last.y)**2) / 10);
            if (dist > 0) {
                this.renderText(
                    this.mmToPx((last.x + sX)/2, 'x'),
                    this.mmToPx((last.y + sY)/2, 'y') - 10,
                    dist + " см",
                    "live-label"
                );
            }
        }
        
        if (r.elements) {
            r.elements.forEach((el, idx) => {
                let def = window.getElementDef(el.subtype);
                let g = document.createElementNS("http://www.w3.org/2000/svg", "g");
                g.setAttribute("transform", `rotate(${el.rotation || 0}, ${this.mmToPx(el.x, 'x')}, ${this.mmToPx(el.y, 'y')})`);
                
                const isLinear = def.type === 'linear' || el.type === 'rail';
                
                if (r.closed && this.showMeasures) this.drawElementMeasures(el, r);
                
                if (isLinear) {
                    let w = el.width || 2000;
                    let color = el.type === 'rail' ? "#fb8c00" : (el.subtype === 'TRACK' ? "#333" : "var(--light)");
                    let line = this.createLine(
                        this.mmToPx(el.x - w/2, 'x'), this.mmToPx(el.y, 'y'), 
                        this.mmToPx(el.x + w/2, 'x'), this.mmToPx(el.y, 'y'), 
                        color, 5
                    );
                    line.setAttribute("stroke-linecap", "round");
                    g.appendChild(line);
                    
                    let label = this.renderText(
                        this.mmToPx(el.x, 'x'), this.mmToPx(el.y, 'y') - 10, 
                        `${w/10} см`, el.type === 'rail' ? "rail-label" : "light-label"
                    );
                    
                    if (!isExport && window.isMobile) {
                        label.addEventListener('touchstart', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.Mobile.openElementResize(el);
                        }, { passive: false });
                    } else if (!isExport) {
                        label.onclick = (e) => {
                            e.stopPropagation();
                            let nl = prompt("Длина (см):", w/10);
                            if (nl && !isNaN(nl)) {
                                this.saveState();
                                el.width = nl * 10;
                                this.draw();
                            }
                        };
                    }
                } else {
                    g.appendChild(this.drawSymbol(el, def));
                }
                
                if (!isExport) {
                    if (window.isMobile) {
                        g.addEventListener('touchstart', (e) => window.Mobile.handleElementTouchStart(el, idx, e), { passive: false });
                        g.addEventListener('touchend', (e) => window.Mobile.handleElementTouchEnd(el, idx, e), { passive: false });
                        g.addEventListener('touchmove', window.Mobile.handleElementTouchMove, { passive: false });
                        g.addEventListener('touchcancel', window.Mobile.cancelLongPress, { passive: false });
                    } else {
                        g.onmousedown = (e) => {
                            e.stopPropagation();
                            if (e.altKey) {
                                this.saveState();
                                let copy = JSON.parse(JSON.stringify(el));
                                r.elements.push(copy);
                                this.dragElem = copy;
                            } else {
                                this.saveState();
                                this.dragElem = el;
                            }
                        };
                        g.oncontextmenu = (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            this.saveState();
                            r.elements.splice(idx, 1);
                            this.draw();
                        };
                    }
                }
                this.svg.appendChild(g);
            });
        }
        
        if (!isExport) {
            r.points.forEach((p, i) => {
                let c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                c.setAttribute("cx", this.mmToPx(p.x, 'x'));
                c.setAttribute("cy", this.mmToPx(p.y, 'y'));
                c.setAttribute("r", this.selectedPointId === p.id ? 8 : 5);
                c.setAttribute("fill", this.selectedPointId === p.id ? "var(--primary)" : "white");
                c.setAttribute("stroke", "#e74c3c");
                c.setAttribute("stroke-width", 2);
                
                if (window.isMobile) {
                    c.addEventListener('touchstart', (e) => window.Mobile.handlePointTouchStart(p.id, e), { passive: false });
                    c.addEventListener('touchend', (e) => window.Mobile.handlePointTouchEnd(p.id, e), { passive: false });
                    c.addEventListener('touchmove', window.Mobile.handlePointTouchMove, { passive: false });
                    c.addEventListener('touchcancel', window.Mobile.cancelLongPress, { passive: false });
                } else {
                    c.onmousedown = (e) => {
                        e.stopPropagation();
                        if (this.currentTool === 'draw') {
                            this.saveState();
                            this.dragId = p.id;
                        }
                    };
                    c.oncontextmenu = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.saveState();
                        r.points.splice(i, 1);
                        if (r.points.length < 3) r.closed = false;
                        this.draw();
                    };
                }
                this.svg.appendChild(c);
            });
        }
        
        this.updateStats();
    },

    drawSymbol: function(el, def) {
        let cx = this.mmToPx(el.x, 'x'), cy = this.mmToPx(el.y, 'y');
        let s = document.createElementNS("http://www.w3.org/2000/svg", "g");
        
        if (el.subtype === 'GX53') {
            s.innerHTML = `<circle cx="${cx}" cy="${cy}" r="8" fill="white" stroke="black" stroke-width="1.5"/><circle cx="${cx}" cy="${cy}" r="4" fill="black"/>`;
            return s;
        }
        if (el.subtype === 'CHANDELIER') {
            s.innerHTML = `<circle cx="${cx}" cy="${cy}" r="10" fill="white" stroke="black" stroke-width="1.5"/><path d="M${cx-7} ${cy} L${cx+7} ${cy} M${cx} ${cy-7} L${cx} ${cy+7} M${cx-5} ${cy-5} L${cx+5} ${cy+5} M${cx+5} ${cy-5} L${cx-5} ${cy+5}" stroke="black" stroke-width="1"/>`;
            return s;
        }
        if (el.subtype === 'FIRE_ALARM') {
            s.innerHTML = `<circle cx="${cx}" cy="${cy}" r="8" fill="white" stroke="#ff5252" stroke-width="2"/><path d="M${cx-4} ${cy-4} L${cx+4} ${cy+4} M${cx+4} ${cy-4} L${cx-4} ${cy+4}" stroke="#ff5252" stroke-width="1.5"/>`;
            return s;
        }
        if (el.type === 'pipe') {
            s.innerHTML = `<circle cx="${cx}" cy="${cy}" r="6" fill="#9e9e9e" stroke="black" stroke-width="1"/><path d="M${cx-3} ${cy-3} L${cx+3} ${cy+3}" stroke="white" stroke-width="1"/>`;
            return s;
        }
        
        let shape = def.shape || 'circle';
        let fill = def.type === 'service' ? '#e0f7fa' : 'white';
        let stroke = '#2c3e50';
        
        if (def.type === 'service') {
            s.innerHTML = `<path d="M${cx} ${cy-10} L${cx+2} ${cy-3} L${cx+9} ${cy-3} L${cx+3} ${cy+2} L${cx+5} ${cy+9} L${cx} ${cy+5} L${cx-5} ${cy+9} L${cx-3} ${cy+2} L${cx-9} ${cy-3} L${cx-2} ${cy-3} Z" fill="#ffd700" stroke="#f57f17" stroke-width="1"/>`;
            return s;
        }
        
        if (shape === 'square') {
            s.innerHTML = `<rect x="${cx-9}" y="${cy-9}" width="18" height="18" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
        } else if (shape === 'triangle') {
            s.innerHTML = `<polygon points="${cx},${cy-10} ${cx+9},${cy+8} ${cx-9},${cy+8}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
        } else if (shape === 'diamond') {
            s.innerHTML = `<polygon points="${cx},${cy-10} ${cx+10},${cy} ${cx},${cy+10} ${cx-10},${cy}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
        } else {
            s.innerHTML = `<circle cx="${cx}" cy="${cy}" r="8" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><circle cx="${cx}" cy="${cy}" r="2" fill="${stroke}"/>`;
        }
        return s;
    },

    drawElementMeasures: function(el, room) {
        let def = window.getElementDef(el.subtype);
        const isLinear = def.type === 'linear' || el.type === 'rail';
        let anchorPoints = [];
        
        if (isLinear) {
            let w = (el.width || 2000) / 2;
            let rad = (el.rotation || 0) * Math.PI / 180;
            anchorPoints.push({ x: el.x - w * Math.cos(rad), y: el.y - w * Math.sin(rad) });
            anchorPoints.push({ x: el.x + w * Math.cos(rad), y: el.y + w * Math.sin(rad) });
        } else {
            anchorPoints.push({ x: el.x, y: el.y });
        }
        
        anchorPoints.forEach(pt => {
            let dists = [];
            for (let i = 0; i < room.points.length; i++) {
                let p1 = room.points[i];
                let p2 = room.points[(i + 1) % room.points.length];
                if (Math.abs(p1.x - p2.x) < 1 && pt.y >= Math.min(p1.y, p2.y) && pt.y <= Math.max(p1.y, p2.y)) {
                    dists.push({ axis: 'x', val: p1.x, d: Math.abs(pt.x - p1.x), pt: pt });
                } else if (Math.abs(p1.y - p2.y) < 1 && pt.x >= Math.min(p1.x, p2.x) && pt.x <= Math.max(p1.x, p2.x)) {
                    dists.push({ axis: 'y', val: p1.y, d: Math.abs(pt.y - p1.y), pt: pt });
                }
            }
            
            let bX = dists.filter(d => d.axis === 'x').sort((a, b) => a.d - b.d)[0];
            let bY = dists.filter(d => d.axis === 'y').sort((a, b) => a.d - b.d)[0];
            
            if (bX) {
                this.svg.appendChild(this.createLine(
                    this.mmToPx(bX.pt.x, 'x'), this.mmToPx(bX.pt.y, 'y'), 
                    this.mmToPx(bX.val, 'x'), this.mmToPx(bX.pt.y, 'y'), 
                    "var(--danger)", 0.8, "2,2"
                ));
                this.renderText(
                    this.mmToPx(bX.pt.x + (bX.val > bX.pt.x ? 100 : -100), 'x'), 
                    this.mmToPx(bX.pt.y, 'y') - 5, 
                    Math.round(bX.d / 10) + " см", "measure-label"
                );
            }
            if (bY) {
                this.svg.appendChild(this.createLine(
                    this.mmToPx(bY.pt.x, 'x'), this.mmToPx(bY.pt.y, 'y'), 
                    this.mmToPx(bY.pt.x, 'x'), this.mmToPx(bY.val, 'y'), 
                    "var(--danger)", 0.8, "2,2"
                ));
                this.renderText(
                    this.mmToPx(bY.pt.x, 'x') + 15, 
                    this.mmToPx(bY.pt.y + (bY.val > bY.pt.y ? 100 : -100), 'y'), 
                    Math.round(bY.d / 10) + " см", "measure-label"
                );
            }
        });
    },

    // ========== ОБРАБОТЧИКИ МЫШИ ==========

    initMouseHandlers: function() {
        this.svg.onmousemove = (e) => {
            if (window.isMobile) return;
            const rect = this.svg.getBoundingClientRect();
            this.mousePos.x = e.clientX - rect.left;
            this.mousePos.y = e.clientY - rect.top;
            this.mousePos.shift = e.shiftKey;
            
            if (this.isPanning) {
                this.offsetX = e.clientX - this.startPanX;
                this.offsetY = e.clientY - this.startPanY;
                this.draw();
                return;
            }
            if (this.dragId) {
                let p = this.rooms[this.activeRoom].points.find(pt => pt.id === this.dragId);
                if (p) {
                    p.x = this.snap(this.pxToMm(this.mousePos.x, 'x'));
                    p.y = this.snap(this.pxToMm(this.mousePos.y, 'y'));
                    this.draw();
                    this.drawSmartGuides(p.x, p.y, this.dragId);
                }
                return;
            }
            if (this.dragElem) {
                let s = this.getSnappedPos(this.pxToMm(this.mousePos.x, 'x'), this.pxToMm(this.mousePos.y, 'y'), this.dragElem);
                this.dragElem.x = s.x;
                this.dragElem.y = s.y;
                this.draw();
                this.drawSmartGuides(this.dragElem.x, this.dragElem.y, null);
                return;
            }
            this.draw();
        };

        this.svg.onmousedown = (e) => {
            if (window.isMobile) return;
            if (e.target === this.svg && this.currentTool === 'draw') {
                this.isPanning = true;
                this.startPanX = e.clientX - this.offsetX;
                this.startPanY = e.clientY - this.offsetY;
            }
        };

        window.onmouseup = () => {
            if (window.isMobile) return;
            this.isPanning = false;
            this.dragId = null;
            this.dragElem = null;
        };

        this.svg.onclick = (e) => {
            if (window.isMobile) return;
            if (this.isPanning) return;
            
            let r = this.rooms[this.activeRoom];
            if (!r) return;
            
            let rect = this.svg.getBoundingClientRect();
            let mmX = this.pxToMm(e.clientX - rect.left, 'x');
            let mmY = this.pxToMm(e.clientY - rect.top, 'y');
            
            if (this.currentTool !== 'draw') {
                this.saveState();
                if (!r.elements) r.elements = [];
                
                let sub;
                if (this.currentTool === 'light') sub = document.getElementById("lightTypeSelector").value;
                else if (this.currentTool === 'rail') sub = document.getElementById("railTypeSelector").value;
                else if (this.currentTool === 'extra') sub = document.getElementById("extraTypeSelector").value;
                else if (this.currentTool === 'pipe') sub = 'pipe';
                
                let s = this.getSnappedPos(mmX, mmY);
                let def = window.getElementDef(sub);
                
                let newEl = {
                    type: this.currentTool === 'pipe' ? 'pipe' : this.currentTool,
                    subtype: sub,
                    x: s.x,
                    y: s.y,
                    rotation: 0
                };
                
                const isLinear = def.type === 'linear' || this.currentTool === 'rail' || this.currentTool === 'pipe';
                if (isLinear) {
                    let dl = prompt("Длина (см):", "200");
                    newEl.width = (parseFloat(dl) * 10) || 2000;
                }
                
                r.elements.push(newEl);
                this.draw();
                return;
            }
            
            if (r.closed || this.dragId) return;
            
            let first = r.points[0];
            if (r.points.length >= 3 && first) {
                let firstXpx = this.mmToPx(first.x, 'x');
                let firstYpx = this.mmToPx(first.y, 'y');
                if (Math.sqrt((e.clientX - rect.left - firstXpx)**2 + (e.clientY - rect.top - firstYpx)**2) < 25) {
                    this.saveState();
                    r.closed = true;
                    this.draw();
                    return;
                }
            }
            
            this.saveState();
            let sX = this.snap(mmX, first ? first.x : null);
            let sY = this.snap(mmY, first ? first.y : null);
            
            let last = r.points[r.points.length - 1];
            if (last && !e.shiftKey) {
                if (Math.abs(sX - last.x) > Math.abs(sY - last.y)) {
                    sY = last.y;
                } else {
                    sX = last.x;
                }
            }
            
            r.points.push({ id: Date.now() + Math.random(), x: sX, y: sY });
            this.draw();
        };

        this.svg.addEventListener("wheel", (e) => {
            e.preventDefault();
            
            if (e.shiftKey) {
                let r = this.rooms[this.activeRoom];
                let mmX = this.pxToMm(this.mousePos.x, 'x');
                let mmY = this.pxToMm(this.mousePos.y, 'y');
                let target = r.elements?.find(el => Math.sqrt((el.x-mmX)**2 + (el.y-mmY)**2) < 200);
                if (target) {
                    target.rotation = (target.rotation || 0) + (e.deltaY > 0 ? 1 : -1);
                    this.draw();
                    return;
                }
            }
            
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const rect = this.svg.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this.offsetX = x - (x - this.offsetX) * delta;
            this.offsetY = y - (y - this.offsetY) * delta;
            this.scale *= delta;
            this.draw();
        }, { passive: false });
    },

    // ========== ФУНКЦИИ РАБОТЫ С КОМНАТАМИ ==========

    addRoom: function() {
        if(window.currentUser && window.currentUser.plan === 'free' && this.rooms.length >= 1) {
            alert("В бесплатном плане доступно только 1 помещение. Перейдите на PRO для безлимита.");
            return;
        }
        this.showRoomTypeModal();
    },

    removeRoom: function(idx, e) {
        e.stopPropagation();
        if (confirm("Удалить это помещение?")) {
            this.saveState();
            this.rooms.splice(idx, 1);
            this.activeRoom = Math.max(0, this.activeRoom - 1);
            if (this.rooms.length === 0) this.addRoom();
            this.renderTabs();
            this.draw();
        }
    },

    renderTabs: function() {
        const tabs = document.getElementById("tabs");
        tabs.innerHTML = "";
        this.rooms.forEach((r, i) => {
            let t = document.createElement("div");
            t.className = "tab" + (i === this.activeRoom ? " active" : "");
            t.innerHTML = `${r.name} <span class="close-tab" onclick="window.Drawing.removeRoom(${i}, event)">×</span>`;
            t.onclick = () => {
                this.activeRoom = i;
                this.renderTabs();
                this.draw();
            };
            tabs.appendChild(t);
        });
        
        this.updateZoomLevel();
    },

    // ========== ФУНКЦИИ ЗУМА ==========

    updateZoomLevel: function() {
        const zoomLevel = document.getElementById('zoom-level');
        if (zoomLevel) {
            zoomLevel.textContent = Math.round(this.scale * 100) + '%';
        }
    },

    zoomIn: function() {
        const rect = this.svg.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        let newScale = Math.min(this.scale * 1.2, 3.0);
        
        if (newScale !== this.scale) {
            this.offsetX = centerX - (centerX - this.offsetX) * (newScale / this.scale);
            this.offsetY = centerY - (centerY - this.offsetY) * (newScale / this.scale);
            this.scale = newScale;
            this.updateZoomLevel();
            this.draw();
        }
    },

    zoomOut: function() {
        const rect = this.svg.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        let newScale = this.scale * 0.8;
        
        this.offsetX = centerX - (centerX - this.offsetX) * (newScale / this.scale);
        this.offsetY = centerY - (centerY - this.offsetY) * (newScale / this.scale);
        this.scale = newScale;
        this.updateZoomLevel();
        this.draw();
    },

    resetView: function() {
        this.scale = 0.18;
        this.offsetX = 100;
        this.offsetY = 100;
        this.updateZoomLevel();
        this.draw();
    },

    setScaleFor5x5: function() {
        const roomWidth = 5000;
        const roomHeight = 5000;
        
        const container = document.getElementById('canvas-container');
        if (!container) return;
        
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        if (containerWidth === 0 || containerHeight === 0) {
            console.log("⚠️ Контейнер еще не загружен, пробуем позже");
            setTimeout(() => this.setScaleFor5x5(), 50);
            return;
        }
        
        const roomWidthPx = roomWidth * this.MM_TO_PX;
        const roomHeightPx = roomHeight * this.MM_TO_PX;
        
        const scaleX = (containerWidth * 0.8) / roomWidthPx;
        const scaleY = (containerHeight * 0.8) / roomHeightPx;
        
        let newScale = Math.min(scaleX, scaleY);
        this.scale = Math.max(0.1, Math.min(1.0, newScale));
        
        this.offsetX = containerWidth / 2;
        this.offsetY = containerHeight / 2;
        
        this.updateZoomLevel();
        console.log("📐 Масштаб установлен для 5x5 метров:", this.scale.toFixed(3));
    },

    centerView: function() {
        const r = this.rooms[this.activeRoom];
        if (!r || r.points.length === 0) return;
        
        let minX = Math.min(...r.points.map(p => p.x));
        let maxX = Math.max(...r.points.map(p => p.x));
        let minY = Math.min(...r.points.map(p => p.y));
        let maxY = Math.max(...r.points.map(p => p.y));
        
        const padding = 500;
        minX -= padding;
        maxX += padding;
        minY -= padding;
        maxY += padding;
        
        const width = maxX - minX;
        const height = maxY - minY;
        
        const container = document.getElementById('canvas-container');
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        
        const scaleX = (containerWidth * 0.9) / (width * this.MM_TO_PX);
        const scaleY = (containerHeight * 0.9) / (height * this.MM_TO_PX);
        this.scale = Math.min(scaleX, scaleY);
        
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        
        this.offsetX = containerWidth / 2 - centerX * this.MM_TO_PX * this.scale;
        this.offsetY = containerHeight / 2 - centerY * this.MM_TO_PX * this.scale;
        
        this.updateZoomLevel();
        this.draw();
    },

    // ========== ФУНКЦИИ СТАТИСТИКИ ==========

    updateStats: function() {
        let listHTML = "";
        let totalArea = 0;
        let totalPerim = 0;
        let totalElemCounts = {};
        
        this.rooms.forEach((r, idx) => {
            let p = 0, a = 0;
            for(let i=0; i<r.points.length; i++) {
                let j = (i+1)%r.points.length;
                p += Math.sqrt((r.points[j].x-r.points[i].x)**2 + (r.points[j].y-r.points[i].y)**2);
                if(r.closed) a += r.points[i].x * r.points[j].y - r.points[j].x * r.points[i].y;
            }
            let ra = r.closed ? Math.abs(a/2)/1000000 : 0;
            totalArea += ra;
            totalPerim += (p/1000);
            
            if (idx === this.activeRoom) {
                document.getElementById("roomTitle").innerText = r.name;
                document.getElementById("currentArea").innerText = ra.toFixed(2) + " м²";
                document.getElementById("currentPerim").innerText = (p/1000).toFixed(2) + " м";
                
                if (r.elements?.length > 0) {
                    let counts = {};
                    r.elements.forEach(el => {
                        let name = el.type === 'pipe' ? 'Обвод трубы' : (window.LIGHT_DATA[el.subtype]?.label || window.EXTRA_DATA[el.subtype]?.label || window.RAIL_DATA[el.subtype]?.label || el.subtype);
                        let key = el.width ? `${name} (${el.width/10} см)` : name;
                        counts[key] = (counts[key] || 0) + 1;
                    });
                    for (let k in counts) {
                        listHTML += `<div class="estimate-item"><span>${k}</span> <span class="estimate-qty">${counts[k]} шт.</span></div>`;
                    }
                } else {
                    listHTML = "Нет элементов";
                }
            }
            
            r.elements?.forEach(el => {
                let name = el.type === 'pipe' ? 'Обвод трубы' : (window.LIGHT_DATA[el.subtype]?.label || window.EXTRA_DATA[el.subtype]?.label || window.RAIL_DATA[el.subtype]?.label || el.subtype);
                let key = el.width ? `${name} (${el.width/10} см)` : name;
                totalElemCounts[key] = (totalElemCounts[key] || 0) + 1;
            });
        });
        
        document.getElementById("elementsList").innerHTML = listHTML;
        document.getElementById("totalArea").innerText = totalArea.toFixed(2) + " м²";
        document.getElementById("totalPerim").innerText = totalPerim.toFixed(2) + " м";
        
        let teH = "";
        for (let n in totalElemCounts) {
            teH += `${n}: ${totalElemCounts[n]} шт. | `;
        }
        document.getElementById("totalElements").innerText = teH || "Нет элементов";
        
        return totalElemCounts;
    },

    generateFullEstimate: function() {
        let totalArea = 0, totalPerim = 0, globalElements = {}; 
        this.rooms.forEach(r => {
            let p = 0, a = 0;
            for(let i=0; i<r.points.length; i++) {
                let j = (i+1)%r.points.length;
                p += Math.sqrt((r.points[j].x-r.points[i].x)**2 + (r.points[j].y-r.points[i].y)**2);
                if(r.closed) a += r.points[i].x * r.points[j].y - r.points[j].x * r.points[i].y;
            }
            totalArea += r.closed ? Math.abs(a/2)/1000000 : 0;
            totalPerim += (p/1000);
            if (r.elements) {
                r.elements.forEach(el => {
                    let key = el.type === 'pipe' ? 'pipe' : el.subtype;
                    if (!globalElements[key]) globalElements[key] = { count: 0, length: 0 };
                    globalElements[key].count++;
                    if (el.width) globalElements[key].length += (el.width / 1000);
                });
            }
        });
        
        let totalSum = 0, rowsHTML = "";
        let priceM2 = window.prices['Полотно (м2)'] || 0;
        let costArea = totalArea * priceM2;
        totalSum += costArea;
        rowsHTML += `<tr><td>Полотно (ПВХ)</td><td>${totalArea.toFixed(2)} м²</td><td>${priceM2}</td><td>${costArea.toFixed(0)}</td></tr>`;
        
        let priceMP = window.prices['Профиль (м.п.)'] || 0;
        let costPerim = totalPerim * priceMP;
        totalSum += costPerim;
        rowsHTML += `<tr><td>Профиль стеновой</td><td>${totalPerim.toFixed(2)} м.п.</td><td>${priceMP}</td><td>${costPerim.toFixed(0)}</td></tr>`;
        
        for (let key in globalElements) {
            let data = globalElements[key];
            let def = window.getElementDef(key);
            let price = window.prices[key] || 0;
            let sum = 0;
            let qtyString = "";
            if (key === 'pipe') {
                sum = data.count * price;
                qtyString = `${data.count} шт.`;
            } else if (def.type === 'linear') {
                sum = data.length * price;
                qtyString = `${data.length.toFixed(2)} м.п.`;
            } else {
                sum = data.count * price;
                qtyString = `${data.count} шт.`;
            }
            totalSum += sum;
            let displayName = def.label || (key === 'pipe' ? 'Обвод трубы' : key);
            rowsHTML += `<tr><td>${displayName}</td><td>${qtyString}</td><td>${price}</td><td>${sum.toFixed(0)}</td></tr>`;
        }
        
        const win = window.open("", "_blank");
        win.document.write(`<html><head><title>Смета</title><style>body{font-family:sans-serif;padding:30px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:12px}.total{margin-top:20px;font-size:24px;background:#2c3e50;color:white;padding:20px;text-align:right}</style></head><body><h1>СМЕТА ПО ОБЪЕКТУ</h1><table><thead><tr><th>Наименование</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>${rowsHTML}</tbody></table><div class="total">ИТОГО: ${totalSum.toFixed(0)} руб.</div></body></html>`);
        win.document.close();
    },

    mirrorRoom: function() {
        this.saveState();
        let r = this.rooms[this.activeRoom];
        if (!r || r.points.length === 0) return;
        let minX = Math.min(...r.points.map(p => p.x));
        let maxX = Math.max(...r.points.map(p => p.x));
        let mid = (minX + maxX) / 2;
        r.points.forEach(p => { p.x = mid - (p.x - mid); });
        if (r.elements) {
            r.elements.forEach(el => {
                el.x = mid - (el.x - mid);
                if (el.rotation) el.rotation = -el.rotation;
            });
        }
        this.draw();
    },

    exportImage: function() {
        this.draw(true);
        let svgData = new XMLSerializer().serializeToString(this.svg);
        let canvas = document.createElement("canvas");
        canvas.width = this.svg.clientWidth * 2;
        canvas.height = this.svg.clientHeight * 2;
        let ctx = canvas.getContext("2d");
        let img = new Image();
        
        img.onload = () => {
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.scale(2, 2);
            ctx.drawImage(img, 0, 0);
            let a = document.createElement("a");
            a.download = "plan.png";
            a.href = canvas.toDataURL();
            a.click();
            this.draw();
        };
        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    },

    resizeWall: function(i) {
        let r = this.rooms[this.activeRoom];
        let p1 = r.points[i];
        let p2 = r.points[(i + 1) % r.points.length];
        let curLen = Math.round(Math.sqrt((p2.x-p1.x)**2 + (p2.y-p1.y)**2)/10);
        let n = prompt("Новая длина стены (см):", curLen);
        
        if (n && !isNaN(n)) {
            this.saveState();
            let nl = n * 10;
            let ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            let dx = Math.cos(ang) * nl - (p2.x - p1.x);
            let dy = Math.sin(ang) * nl - (p2.y - p1.y);
            
            for (let k = (i + 1) % r.points.length; k < r.points.length; k++) {
                if (k === 0 && r.closed) continue;
                r.points[k].x += dx;
                r.points[k].y += dy;
                if (k === 0) break;
            }
            this.draw();
        }
    },

    drawSmartGuides: function(currentX, currentY, excludeId) {
        let r = this.rooms[this.activeRoom];
        if (!r) return;
        
        r.points.forEach(p => {
            if (p.id === excludeId) return;
            
            if (Math.abs(p.x - currentX) < 20) {
                this.svg.appendChild(this.createLine(
                    this.mmToPx(p.x, 'x'), 0,
                    this.mmToPx(p.x, 'x'), this.svg.clientHeight,
                    "rgba(0, 188, 212, 0.4)", 1, "5,5"
                ));
            }
            
            if (Math.abs(p.y - currentY) < 20) {
                this.svg.appendChild(this.createLine(
                    0, this.mmToPx(p.y, 'y'),
                    this.svg.clientWidth, this.mmToPx(p.y, 'y'),
                    "rgba(0, 188, 212, 0.4)", 1, "5,5"
                ));
            }
        });
    },

    updatePlanDisplay: function() {
        const headerPlan = document.getElementById('header-plan');
        if (!headerPlan || !window.currentUser) return;
        
        if (window.currentUser.plan === 'pro') {
            headerPlan.innerText = "План: PRO";
            headerPlan.style.background = 'var(--gold)';
            headerPlan.style.color = 'var(--dark)';
        } else {
            headerPlan.innerText = "План: " + (window.currentUser.plan || 'FREE').toUpperCase();
            headerPlan.style.background = '';
            headerPlan.style.color = '';
        }
    },

    completeAuth: function() {
        document.getElementById('auth-overlay').style.display = 'none';
        document.getElementById('header-user').innerText = window.currentUser.name;
        document.getElementById('header-plan').innerText = "План: " + window.currentUser.plan.toUpperCase();
        
        if(window.currentUser.plan === 'pro') {
            document.getElementById('header-plan').style.background = 'var(--gold)';
            document.getElementById('header-plan').style.color = 'var(--dark)';
        }

        window.loadAllSettings();
        
        if (window.currentUser && window.currentUser.uid && window.db) {
            window.loadCustomElementsFromFirestore(window.currentUser.uid).then(() => window.initSelectors());
        } else {
            window.initSelectors();
        }
        
        if(window.currentUser.plan === 'free' && this.rooms.length > 1) {
            this.rooms = this.rooms.slice(0, 1);
            this.renderTabs();
        } else if (this.rooms.length === 0) {
            setTimeout(() => {
                this.showRoomTypeModal();
            }, 500);
        }

        this.updatePlanDisplay();
        
        if (typeof window.Admin?.updateAdminPanelVisibility === 'function') {
            window.Admin.updateAdminPanelVisibility();
        }

        this.setScaleFor5x5();
        this.draw();

        if (typeof window.Mobile?.initMobileHandlers === 'function') {
            window.Mobile.initMobileHandlers();
        }
    },

    // ========== ФУНКЦИИ ДЛЯ СОЗДАНИЯ НОВЫХ ПОМЕЩЕНИЙ ==========

    showRoomTypeModal: function() {
        if (this.skipRoomTypeModal) {
            this.skipRoomTypeModal = false;
            this.createEmptyRoom();
            return;
        }
        
        if(window.currentUser && window.currentUser.plan === 'free' && this.rooms.length >= 1) {
            alert("В бесплатном плане доступно только 1 помещение. Перейдите на PRO для безлимита.");
            return;
        }
        
        document.getElementById('roomTypeModal').style.display = 'block';
    },

    closeRoomTypeModal: function() {
        document.getElementById('roomTypeModal').style.display = 'none';
    },

    selectRoomType: function(type) {
        this.closeRoomTypeModal();
        
        if (type === 'rectangle') {
            document.getElementById('rectangleSizeModal').style.display = 'block';
        } else {
            this.createEmptyRoom();
        }
    },

    closeRectangleModal: function() {
        document.getElementById('rectangleSizeModal').style.display = 'none';
    },

    buildRectangleRoom: function() {
        const lengthCm = parseInt(document.getElementById('rect-length').value);
        const widthCm = parseInt(document.getElementById('rect-width').value);
        
        if (isNaN(lengthCm) || isNaN(widthCm) || lengthCm < 50 || widthCm < 50) {
            alert("Введите корректные размеры (минимум 50 см)");
            return;
        }
        
        if (lengthCm > 2000 || widthCm > 2000) {
            alert("Максимальный размер - 2000 см (20 метров)");
            return;
        }
        
        this.closeRectangleModal();
        
        const lengthMm = lengthCm * 10;
        const widthMm = widthCm * 10;
        
        this.saveState();
        
        const centerX = 0;
        const centerY = 0;
        
        const halfLength = lengthMm / 2;
        const halfWidth = widthMm / 2;
        
        const newRoom = {
            name: "Полотно " + (this.rooms.length + 1),
            points: [
                { id: Date.now() + 1, x: centerX - halfLength, y: centerY - halfWidth },
                { id: Date.now() + 2, x: centerX + halfLength, y: centerY - halfWidth },
                { id: Date.now() + 3, x: centerX + halfLength, y: centerY + halfWidth },
                { id: Date.now() + 4, x: centerX - halfLength, y: centerY + halfWidth }
            ],
            id: Date.now(),
            closed: true,
            elements: []
        };
        
        this.rooms.push(newRoom);
        this.activeRoom = this.rooms.length - 1;
        this.renderTabs();
        
        setTimeout(() => {
            this.centerView();
        }, 100);
        
        this.draw();
        
        console.log(`✅ Построено помещение ${lengthCm} x ${widthCm} см`);
    },

    setRectSize: function(lengthCm, widthCm) {
        document.getElementById('rect-length').value = lengthCm;
        document.getElementById('rect-width').value = widthCm;
    },

    createEmptyRoom: function() {
        this.saveState();
        
        this.rooms.push({
            name: "Полотно " + (this.rooms.length + 1),
            points: [],
            id: Date.now(),
            closed: false,
            elements: []
        });
        
        this.activeRoom = this.rooms.length - 1;
        this.renderTabs();
        this.draw();
        
        console.log("✅ Создано пустое помещение для ручного рисования");
    },

    loadProjectWithSkip: function(projectId) {
        this.skipRoomTypeModal = true;
        window.Projects.loadProject(projectId);
    }
};

// Инициализация ссылки на SVG и обработчиков
Drawing.svg = document.getElementById("canvas");
Drawing.initMouseHandlers();

// Экспортируем в глобальную область
window.Drawing = Drawing;

// Для обратной совместимости с существующим кодом
window.scale = Drawing.scale;
window.offsetX = Drawing.offsetX;
window.offsetY = Drawing.offsetY;
window.rooms = Drawing.rooms;
window.activeRoom = Drawing.activeRoom;
window.currentTool = Drawing.currentTool;
window.showDiagonals = Drawing.showDiagonals;
window.showMeasures = Drawing.showMeasures;
window.history = Drawing.history;
window.selectedPointId = Drawing.selectedPointId;
window.skipRoomTypeModal = Drawing.skipRoomTypeModal;