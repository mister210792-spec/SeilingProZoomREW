// mobile.js

const Mobile = {
    isMobile: /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768,
    mobileTool: 'draw',
    longPressTimer: null,
    selectedElement: null,
    selectedElementIndex: -1,
    selectedPointId: null,
    resizeTarget: null,
    lastTapTime: 0,
    DOUBLE_TAP_DELAY: 300,

    touchState: {
        dragElem: null,
        dragPoint: null,
        startX: 0,
        startY: 0,
        startElemX: 0,
        startElemY: 0,
        startPointX: 0,
        startPointY: 0,
        moved: false
    },

    setMobileTool: function(tool) {
        this.mobileTool = tool;
        document.querySelectorAll('.mobile-tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`mobile-tool-${tool}`).classList.add('active');
        this.selectedElement = null;
        this.selectedPointId = null;
    },

    initMobileHandlers: function() {
        if (!this.isMobile) return;
        
        console.log("✅ Мобильные обработчики инициализированы");
        
        document.getElementById('mobile-tool-draw').addEventListener('click', () => this.setMobileTool('draw'));
        document.getElementById('mobile-tool-edit').addEventListener('click', () => this.setMobileTool('edit'));
        document.getElementById('mobile-tool-delete').addEventListener('click', () => this.setMobileTool('delete'));
        
        const svg = document.getElementById('canvas');
        svg.addEventListener('touchstart', (e) => this.handleGlobalTouchStart(e), { passive: false });
        svg.addEventListener('touchend', (e) => this.handleGlobalTouchEnd(e), { passive: false });
        svg.addEventListener('touchmove', (e) => this.handleGlobalTouchMove(e), { passive: false });
        svg.addEventListener('touchcancel', (e) => this.handleGlobalTouchCancel(e), { passive: false });
        
        this.setupPinchAndPan();
    },

    handleGlobalTouchStart: function(e) {
        if (e.touches.length > 1) return;
        
        const touch = e.touches[0];
        const rect = svg.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;
        
        const currentTime = new Date().getTime();
        const tapLength = currentTime - this.lastTapTime;
        
        if (tapLength < this.DOUBLE_TAP_DELAY && tapLength > 0) {
            e.preventDefault();
            window.lastTapX = touchX;
            window.lastTapY = touchY;
            document.getElementById('addElementMenu').style.display = 'flex';
            this.lastTapTime = 0;
            return;
        }
        this.lastTapTime = currentTime;
        
        this.touchState.startX = touchX;
        this.touchState.startY = touchY;
        this.touchState.moved = false;
    },

    handleGlobalTouchEnd: function(e) {
        if (e.touches.length > 0) return;
        
        if (!this.touchState.moved && this.mobileTool === 'draw' && !this.touchState.dragElem && !this.touchState.dragPoint) {
            const touch = e.changedTouches[0];
            if (touch) {
                const rect = svg.getBoundingClientRect();
                const touchX = touch.clientX - rect.left;
                const touchY = touch.clientY - rect.top;
                this.simulateClickForDrawing(touchX, touchY);
            }
        }
        
        this.touchState.dragElem = null;
        this.touchState.dragPoint = null;
        this.selectedPointId = null;
    },

    handleGlobalTouchMove: function(e) {
        if (e.touches.length > 1) return;
        
        const touch = e.touches[0];
        const rect = svg.getBoundingClientRect();
        const currentX = touch.clientX - rect.left;
        const currentY = touch.clientY - rect.top;
        
        const dx = Math.abs(currentX - this.touchState.startX);
        const dy = Math.abs(currentY - this.touchState.startY);
        
        if (dx > 5 || dy > 5) {
            this.touchState.moved = true;
            this.cancelLongPress();
        }
    },

    handleGlobalTouchCancel: function(e) {
        this.cancelLongPress();
        this.touchState.dragElem = null;
        this.touchState.dragPoint = null;
        this.selectedPointId = null;
    },

    simulateClickForDrawing: function(x, y) {
        let r = window.Drawing.rooms[window.Drawing.activeRoom];
        if (!r || r.closed) return;
        
        let mmX = window.Drawing.pxToMm(x, 'x');
        let mmY = window.Drawing.pxToMm(y, 'y');
        
        let first = r.points[0];
        if (r.points.length >= 3 && first) {
            let firstXpx = window.Drawing.mmToPx(first.x, 'x');
            let firstYpx = window.Drawing.mmToPx(first.y, 'y');
            if (Math.hypot(x - firstXpx, y - firstYpx) < 25) {
                window.Drawing.saveState();
                r.closed = true;
                window.Drawing.draw();
                return;
            }
        }
        
        window.Drawing.saveState();
        let sX = window.Drawing.snap(mmX, first ? first.x : null);
        let sY = window.Drawing.snap(mmY, first ? first.y : null);
        
        let last = r.points[r.points.length - 1];
        if (last) {
            if (Math.abs(sX - last.x) > Math.abs(sY - last.y)) {
                sY = last.y;
            } else {
                sX = last.x;
            }
        }
        
        r.points.push({ id: Date.now() + Math.random(), x: sX, y: sY });
        window.Drawing.draw();
    },

    setupPinchAndPan: function() {
        let initialDistance = 0;
        let initialScale = 1;
        let initialOffsetX = 0;
        let initialOffsetY = 0;
        let pinchCenter = { x: 0, y: 0 };
        let pinchCenterMM = { x: 0, y: 0 };
        let isPanning = false;
        let lastPanX = 0;
        let lastPanY = 0;
        
        const svg = document.getElementById('canvas');
        
        svg.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                
                initialDistance = Math.hypot(
                    touch2.clientX - touch1.clientX,
                    touch2.clientY - touch1.clientY
                );
                initialScale = window.Drawing.scale;
                initialOffsetX = window.Drawing.offsetX;
                initialOffsetY = window.Drawing.offsetY;
                
                const rect = svg.getBoundingClientRect();
                pinchCenter.x = (touch1.clientX + touch2.clientX) / 2 - rect.left;
                pinchCenter.y = (touch1.clientY + touch2.clientY) / 2 - rect.top;
                pinchCenterMM.x = (pinchCenter.x - window.Drawing.offsetX) / (window.Drawing.MM_TO_PX * window.Drawing.scale);
                pinchCenterMM.y = (pinchCenter.y - window.Drawing.offsetY) / (window.Drawing.MM_TO_PX * window.Drawing.scale);
            } else if (e.touches.length === 1 && e.target === svg) {
                isPanning = true;
                const touch = e.touches[0];
                const rect = svg.getBoundingClientRect();
                lastPanX = touch.clientX - rect.left;
                lastPanY = touch.clientY - rect.top;
            }
        });
        
        svg.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                
                const currentDistance = Math.hypot(
                    touch2.clientX - touch1.clientX,
                    touch2.clientY - touch1.clientY
                );
                
                window.Drawing.scale = initialScale * (currentDistance / initialDistance);
                window.Drawing.updateZoomLevel();
                
                const rect = svg.getBoundingClientRect();
                const centerX = (touch1.clientX + touch2.clientX) / 2 - rect.left;
                const centerY = (touch1.clientY + touch2.clientY) / 2 - rect.top;
                
                window.Drawing.offsetX = centerX - pinchCenterMM.x * (window.Drawing.MM_TO_PX * window.Drawing.scale);
                window.Drawing.offsetY = centerY - pinchCenterMM.y * (window.Drawing.MM_TO_PX * window.Drawing.scale);
                
                window.Drawing.draw();
            } else if (e.touches.length === 1 && isPanning) {
                e.preventDefault();
                const touch = e.touches[0];
                const rect = svg.getBoundingClientRect();
                const currentX = touch.clientX - rect.left;
                const currentY = touch.clientY - rect.top;
                
                window.Drawing.offsetX += (currentX - lastPanX);
                window.Drawing.offsetY += (currentY - lastPanY);
                
                lastPanX = currentX;
                lastPanY = currentY;
                
                window.Drawing.draw();
            }
        });
        
        svg.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                initialDistance = 0;
            }
            if (e.touches.length === 0) {
                isPanning = false;
            }
        });
    },

    cancelLongPress: function() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    },

    closeAddElementMenu: function() {
        document.getElementById('addElementMenu').style.display = 'none';
    },

    addMobileElement: function(type) {
        this.closeAddElementMenu();
        
        const r = window.Drawing.rooms[window.Drawing.activeRoom];
        if (!r) return;
        
        let mmX, mmY;
        
        if (window.lastTapX !== undefined) {
            mmX = window.Drawing.pxToMm(window.lastTapX, 'x');
            mmY = window.Drawing.pxToMm(window.lastTapY, 'y');
        } else {
            const rect = svg.getBoundingClientRect();
            mmX = window.Drawing.pxToMm(rect.width / 2, 'x');
            mmY = window.Drawing.pxToMm(rect.height / 2, 'y');
        }
        
        window.Drawing.saveState();
        if (!r.elements) r.elements = [];
        
        let sub;
        if (type === 'light') sub = document.getElementById("lightTypeSelector").value;
        else if (type === 'extra') sub = document.getElementById("extraTypeSelector").value;
        else if (type === 'rail') sub = document.getElementById("railTypeSelector").value;
        else if (type === 'pipe') sub = 'pipe';
        
        let s = window.Drawing.getSnappedPos(mmX, mmY);
        let def = window.getElementDef(sub);
        
        let newEl = {
            type: type === 'pipe' ? 'pipe' : type,
            subtype: sub,
            x: s.x,
            y: s.y,
            rotation: 0
        };
        
        const isLinear = def.type === 'linear' || type === 'rail';
        if (isLinear) {
            newEl.width = 2000;
        }
        
        r.elements.push(newEl);
        window.Drawing.draw();
    },

    showElementContextMenu: function(el) {
        const menu = document.getElementById('elementContextMenu');
        if (!menu) {
            console.error("❌ Контекстное меню не найдено");
            return;
        }
        
        this.selectedElement = el;
        window.currentContextElement = el;
        
        console.log("✅ Открыто меню для элемента:", el);
        
        const hasLength = el.width !== undefined;
        const lengthItem = document.getElementById('menu-edit-length');
        if (lengthItem) {
            lengthItem.style.display = hasLength ? 'block' : 'none';
        }
        
        const rotateItem = document.getElementById('menu-rotate');
        if (rotateItem) {
            rotateItem.style.display = 'block';
        }
        
        menu.style.display = 'flex';
        
        const r = window.Drawing.rooms[window.Drawing.activeRoom];
        if (r && r.elements) {
            const index = r.elements.findIndex(e => e === el);
            if (index !== -1) {
                window.currentContextElementIndex = index;
            }
        }
    },

    closeElementContextMenu: function() {
        document.getElementById('elementContextMenu').style.display = 'none';
        setTimeout(() => {
            this.selectedElement = null;
            window.currentContextElement = null;
            window.currentContextElementIndex = undefined;
        }, 100);
    },

    menuEditLength: function() {
        this.closeElementContextMenu();
        if (this.selectedElement && this.selectedElement.width) {
            this.openElementResize(this.selectedElement);
        }
    },

    menuRotate: function() {
        console.log("🔄 Вызвана функция поворота");
        
        let el = this.selectedElement || window.currentContextElement;
        
        if (!el) {
            if (window.currentContextElementIndex !== undefined) {
                const r = window.Drawing.rooms[window.Drawing.activeRoom];
                if (r && r.elements && r.elements[window.currentContextElementIndex]) {
                    el = r.elements[window.currentContextElementIndex];
                    console.log("✅ Нашли элемент по индексу");
                }
            }
            
            if (!el) {
                alert("Ошибка: выберите элемент заново");
                this.closeElementContextMenu();
                return;
            }
        }
        
        console.log("✅ Элемент найден:", el);
        
        const currentRot = el.rotation || 0;
        const newRot = prompt('Введите угол поворота (0-360°):', currentRot);
        
        if (newRot !== null) {
            const angle = parseFloat(newRot);
            if (!isNaN(angle)) {
                window.Drawing.saveState();
                el.rotation = angle % 360;
                window.Drawing.draw();
                console.log("✅ Элемент повёрнут на угол:", angle);
                this.closeElementContextMenu();
            } else {
                alert("Пожалуйста, введите число");
            }
        } else {
            this.closeElementContextMenu();
        }
    },

    menuDelete: function() {
        this.closeElementContextMenu();
        if (this.selectedElement) {
            if (confirm('Удалить этот элемент?')) {
                window.Drawing.saveState();
                const r = window.Drawing.rooms[window.Drawing.activeRoom];
                const index = r.elements.findIndex(el => el === this.selectedElement);
                if (index !== -1) {
                    r.elements.splice(index, 1);
                    window.Drawing.draw();
                }
            }
        }
    },

    openWallResize: function(wallIndex) {
        const r = window.Drawing.rooms[window.Drawing.activeRoom];
        const p1 = r.points[wallIndex];
        const p2 = r.points[(wallIndex + 1) % r.points.length];
        const curLen = Math.round(Math.sqrt((p2.x-p1.x)**2 + (p2.y-p1.y)**2)/10);
        
        this.resizeTarget = { type: 'wall', index: wallIndex };
        
        document.getElementById('resizeModalTitle').textContent = 'Изменить длину стены';
        document.getElementById('currentLength').textContent = curLen;
        
        const slider = document.getElementById('resizeSlider');
        const input = document.getElementById('resizeInput');
        slider.value = curLen;
        input.value = curLen;
        slider.min = 10;
        slider.max = 1000;
        
        document.getElementById('resizeModal').style.display = 'block';
    },

    openElementResize: function(el) {
        const curLen = Math.round(el.width / 10);
        
        this.resizeTarget = { type: 'element', element: el };
        
        document.getElementById('resizeModalTitle').textContent = 'Изменить длину элемента';
        document.getElementById('currentLength').textContent = curLen;
        
        const slider = document.getElementById('resizeSlider');
        const input = document.getElementById('resizeInput');
        slider.value = curLen;
        input.value = curLen;
        slider.min = 10;
        slider.max = 1000;
        
        document.getElementById('resizeModal').style.display = 'block';
    },

    closeResizeModal: function() {
        document.getElementById('resizeModal').style.display = 'none';
        this.resizeTarget = null;
    },

    applyResize: function() {
        const newLen = parseFloat(document.getElementById('resizeInput').value);
        if (isNaN(newLen) || newLen < 10) {
            alert('Введите корректную длину (минимум 10 см)');
            return;
        }
        
        window.Drawing.saveState();
        
        if (this.resizeTarget.type === 'wall') {
            const r = window.Drawing.rooms[window.Drawing.activeRoom];
            const i = this.resizeTarget.index;
            const p1 = r.points[i];
            const p2 = r.points[(i + 1) % r.points.length];
            const nl = newLen * 10;
            const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            const dx = Math.cos(ang) * nl - (p2.x - p1.x);
            const dy = Math.sin(ang) * nl - (p2.y - p1.y);
            
            for (let k = (i + 1) % r.points.length; k < r.points.length; k++) {
                if (k === 0 && r.closed) continue;
                r.points[k].x += dx;
                r.points[k].y += dy;
                if (k === 0) break;
            }
        } else if (this.resizeTarget.type === 'element') {
            this.resizeTarget.element.width = newLen * 10;
        }
        
        this.closeResizeModal();
        window.Drawing.draw();
    },

    handleElementTouchStart: function(el, idx, e) {
        e.preventDefault();
        e.stopPropagation();
        
        this.cancelLongPress();
        
        const touch = e.touches[0];
        const rect = svg.getBoundingClientRect();
        
        this.touchState.dragElem = el;
        this.touchState.startX = touch.clientX - rect.left;
        this.touchState.startY = touch.clientY - rect.top;
        this.touchState.startElemX = el.x;
        this.touchState.startElemY = el.y;
        this.touchState.moved = false;
        
        this.longPressTimer = setTimeout(() => {
            if (this.mobileTool === 'delete') {
                if (confirm('Удалить этот элемент?')) {
                    window.Drawing.saveState();
                    window.Drawing.rooms[window.Drawing.activeRoom].elements.splice(idx, 1);
                    window.Drawing.draw();
                }
            } else {
                this.selectedElement = el;
                this.selectedElementIndex = idx;
                this.showElementContextMenu(el);
            }
            this.longPressTimer = null;
        }, 500);
    },

    handleElementTouchEnd: function(el, idx, e) {
        e.preventDefault();
        e.stopPropagation();
        
        this.cancelLongPress();
        
        if (!this.touchState.moved) {
            console.log("👆 Короткое нажатие на элемент, idx:", idx);
            
            if (this.mobileTool === 'delete') {
                if (confirm('Удалить этот элемент?')) {
                    window.Drawing.saveState();
                    window.Drawing.rooms[window.Drawing.activeRoom].elements.splice(idx, 1);
                    window.Drawing.draw();
                }
            } else {
                this.selectedElement = el;
                window.currentContextElement = el;
                window.currentContextElementIndex = idx;
                this.showElementContextMenu(el);
            }
        }
        
        this.touchState.dragElem = null;
    },

    handleElementTouchMove: function(e) {
        if (!Mobile.touchState.dragElem) return;
        
        e.preventDefault();
        
        const touch = e.touches[0];
        const rect = svg.getBoundingClientRect();
        const currentX = touch.clientX - rect.left;
        const currentY = touch.clientY - rect.top;
        
        const deltaX = currentX - Mobile.touchState.startX;
        const deltaY = currentY - Mobile.touchState.startY;
        
        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
            Mobile.cancelLongPress();
            Mobile.touchState.moved = true;
        }
        
        const deltaMmX = deltaX / (window.Drawing.MM_TO_PX * window.Drawing.scale);
        const deltaMmY = deltaY / (window.Drawing.MM_TO_PX * window.Drawing.scale);
        
        Mobile.touchState.dragElem.x = Mobile.touchState.startElemX + deltaMmX;
        Mobile.touchState.dragElem.y = Mobile.touchState.startElemY + deltaMmY;
        
        window.Drawing.draw();
    },

    handlePointTouchStart: function(pointId, e) {
        e.preventDefault();
        e.stopPropagation();
        
        this.cancelLongPress();
        
        const touch = e.touches[0];
        const rect = svg.getBoundingClientRect();
        const point = window.Drawing.rooms[window.Drawing.activeRoom].points.find(p => p.id === pointId);
        
        if (!point) return;
        
        this.touchState.dragPoint = point;
        this.touchState.startX = touch.clientX - rect.left;
        this.touchState.startY = touch.clientY - rect.top;
        this.touchState.startPointX = point.x;
        this.touchState.startPointY = point.y;
        this.touchState.moved = false;
        
        this.selectedPointId = pointId;
        
        this.longPressTimer = setTimeout(() => {
            if (this.mobileTool === 'delete') {
                const r = window.Drawing.rooms[window.Drawing.activeRoom];
                const index = r.points.findIndex(p => p.id === pointId);
                if (index !== -1) {
                    window.Drawing.saveState();
                    r.points.splice(index, 1);
                    if (r.points.length < 3) r.closed = false;
                    window.Drawing.draw();
                }
            }
            this.longPressTimer = null;
        }, 500);
    },

    handlePointTouchEnd: function(pointId, e) {
        e.preventDefault();
        e.stopPropagation();
        
        this.cancelLongPress();
        this.touchState.dragPoint = null;
        this.selectedPointId = null;
    },

    handlePointTouchMove: function(e) {
        if (!Mobile.touchState.dragPoint) return;
        
        e.preventDefault();
        
        const touch = e.touches[0];
        const rect = svg.getBoundingClientRect();
        const currentX = touch.clientX - rect.left;
        const currentY = touch.clientY - rect.top;
        
        const deltaX = currentX - Mobile.touchState.startX;
        const deltaY = currentY - Mobile.touchState.startY;
        
        if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
            Mobile.cancelLongPress();
            Mobile.touchState.moved = true;
        }
        
        const deltaMmX = deltaX / (window.Drawing.MM_TO_PX * window.Drawing.scale);
        const deltaMmY = deltaY / (window.Drawing.MM_TO_PX * window.Drawing.scale);
        
        Mobile.touchState.dragPoint.x = window.Drawing.snap(Mobile.touchState.startPointX + deltaMmX);
        Mobile.touchState.dragPoint.y = window.Drawing.snap(Mobile.touchState.startPointY + deltaMmY);
        
        window.Drawing.draw();
    }
};

// Глобальная переменная для определения мобильности
window.isMobile = Mobile.isMobile;

// Экспорт в глобальную область
window.Mobile = Mobile;