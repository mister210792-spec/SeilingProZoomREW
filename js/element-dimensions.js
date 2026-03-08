// element-dimensions.js - Функции для редактирования размеров элементов от стен

// Функция для отображения окна редактирования расстояний элемента
function showElementDimensionsModal(el) {
    if (!el) return;
    
    const room = rooms[activeRoom];
    if (!room || !room.points || room.points.length < 3) {
        alert("Сначала замкните контур комнаты");
        return;
    }
    
    // Находим ближайшие стены для элемента
    const distances = calculateDistancesToWalls(el, room);
    
    const modalHtml = `
        <div id="elementDimensionsModal" class="modal" style="display: block; z-index: 7000;">
            <div class="modal-content" style="width: 450px; max-width: 95%;">
                <h3 style="margin-top: 0; display: flex; align-items: center; gap: 10px;">
                    <span>📏 Редактирование размеров</span>
                    <span style="font-size: 14px; color: #666;">${getElementDisplayName(el)}</span>
                </h3>
                
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                        <span style="width: 120px;">От левой стены:</span>
                        <input type="number" id="dist-left" value="${Math.round(distances.left)}" min="0" max="2000" step="5" style="flex: 1; padding: 8px; border: 2px solid #e0e0e0; border-radius: 6px;">
                        <span>см</span>
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                        <span style="width: 120px;">От правой стены:</span>
                        <input type="number" id="dist-right" value="${Math.round(distances.right)}" min="0" max="2000" step="5" style="flex: 1; padding: 8px; border: 2px solid #e0e0e0; border-radius: 6px;">
                        <span>см</span>
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                        <span style="width: 120px;">От верхней стены:</span>
                        <input type="number" id="dist-top" value="${Math.round(distances.top)}" min="0" max="2000" step="5" style="flex: 1; padding: 8px; border: 2px solid #e0e0e0; border-radius: 6px;">
                        <span>см</span>
                    </div>
                    
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                        <span style="width: 120px;">От нижней стены:</span>
                        <input type="number" id="dist-bottom" value="${Math.round(distances.bottom)}" min="0" max="2000" step="5" style="flex: 1; padding: 8px; border: 2px solid #e0e0e0; border-radius: 6px;">
                        <span>см</span>
                    </div>
                </div>
                
                ${el.width ? `
                <div style="margin-bottom: 20px; border-top: 1px solid #eee; padding-top: 15px;">
                    <h4 style="margin: 0 0 10px 0;">📐 Размер элемента</h4>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="width: 120px;">Длина:</span>
                        <input type="number" id="element-length" value="${Math.round(el.width/10)}" min="5" max="1000" step="5" style="flex: 1; padding: 8px; border: 2px solid #e0e0e0; border-radius: 6px;">
                        <span>см</span>
                    </div>
                </div>
                ` : ''}
                
                <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; font-weight: bold;">
                        <span>Предпросмотр позиции:</span>
                        <span id="position-preview">${Math.round(distances.left)}см слева, ${Math.round(distances.top)}см сверху</span>
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button onclick="applyElementDimensions()" style="background: var(--success); color: white; border: none; padding: 10px 20px; border-radius: 8px;">
                        Применить
                    </button>
                    <button onclick="closeElementDimensionsModal()" style="background: #eee; border: none; padding: 10px 20px; border-radius: 8px;">
                        Отмена
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Удаляем старое модальное окно, если есть
    const oldModal = document.getElementById('elementDimensionsModal');
    if (oldModal) oldModal.remove();
    
    // Добавляем новое
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Сохраняем элемент в глобальной переменной для доступа из функций
    window.currentEditingElement = el;
    
    // Добавляем обработчики для实时预览
    ['dist-left', 'dist-right', 'dist-top', 'dist-bottom'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', updatePositionPreview);
    });
    if (el.width) {
        document.getElementById('element-length')?.addEventListener('input', updatePositionPreview);
    }
}

// Функция для расчета расстояний до стен
function calculateDistancesToWalls(el, room) {
    if (!room || !room.points || room.points.length < 4) {
        return { left: 0, right: 0, top: 0, bottom: 0 };
    }
    
    // Находим границы комнаты
    let minX = Math.min(...room.points.map(p => p.x));
    let maxX = Math.max(...room.points.map(p => p.x));
    let minY = Math.min(...room.points.map(p => p.y));
    let maxY = Math.max(...room.points.map(p => p.y));
    
    // Переводим в сантиметры
    return {
        left: (el.x - minX) / 10,
        right: (maxX - el.x) / 10,
        top: (el.y - minY) / 10,
        bottom: (maxY - el.y) / 10
    };
}

// Функция для обновления предпросмотра
function updatePositionPreview() {
    const left = parseFloat(document.getElementById('dist-left')?.value) || 0;
    const top = parseFloat(document.getElementById('dist-top')?.value) || 0;
    
    const preview = document.getElementById('position-preview');
    if (preview) {
        preview.textContent = `${left}см слева, ${top}см сверху`;
    }
}

// Функция для применения новых размеров
function applyElementDimensions() {
    const el = window.currentEditingElement;
    if (!el) {
        closeElementDimensionsModal();
        return;
    }
    
    const room = rooms[activeRoom];
    if (!room) return;
    
    // Находим границы комнаты
    let minX = Math.min(...room.points.map(p => p.x));
    let maxX = Math.max(...room.points.map(p => p.x));
    let minY = Math.min(...room.points.map(p => p.y));
    let maxY = Math.max(...room.points.map(p => p.y));
    
    // Получаем новые расстояния (в см, переводим в мм)
    const left = parseFloat(document.getElementById('dist-left')?.value) * 10;
    const right = parseFloat(document.getElementById('dist-right')?.value) * 10;
    const top = parseFloat(document.getElementById('dist-top')?.value) * 10;
    const bottom = parseFloat(document.getElementById('dist-bottom')?.value) * 10;
    
    // Проверяем корректность
    if (isNaN(left) || isNaN(right) || isNaN(top) || isNaN(bottom)) {
        alert("Введите корректные значения");
        return;
    }
    
    // Проверяем, что сумма расстояний не превышает размер комнаты
    if (left + right > (maxX - minX) + 5) { // +5мм погрешность
        alert(`Сумма расстояний до стен (${(left+right)/10} см) больше ширины комнаты (${(maxX-minX)/10} см)`);
        return;
    }
    
    if (top + bottom > (maxY - minY) + 5) {
        alert(`Сумма расстояний до стен (${(top+bottom)/10} см) больше высоты комнаты (${(maxY-minY)/10} см)`);
        return;
    }
    
    saveState();
    
    // Устанавливаем новую позицию
    el.x = minX + left;
    el.y = minY + top;
    
    // Обновляем длину, если есть
    if (el.width) {
        const newLength = parseFloat(document.getElementById('element-length')?.value) * 10;
        if (!isNaN(newLength) && newLength >= 50) {
            el.width = newLength;
        }
    }
    
    // Перерисовываем
    draw();
    closeElementDimensionsModal();
    
    console.log("✅ Размеры элемента обновлены");
}

// Функция для закрытия модального окна
function closeElementDimensionsModal() {
    const modal = document.getElementById('elementDimensionsModal');
    if (modal) modal.remove();
    window.currentEditingElement = null;
}

// Вспомогательная функция для получения имени элемента
function getElementDisplayName(el) {
    if (el.type === 'pipe') return 'Обвод трубы';
    
    const def = getElementDef(el.subtype);
    return def?.label || el.subtype || 'Элемент';
}

// Экспортируем функции
window.showElementDimensionsModal = showElementDimensionsModal;
window.closeElementDimensionsModal = closeElementDimensionsModal;
window.applyElementDimensions = applyElementDimensions;
window.calculateDistancesToWalls = calculateDistancesToWalls;
window.getElementDisplayName = getElementDisplayName;
window.updatePositionPreview = updatePositionPreview;