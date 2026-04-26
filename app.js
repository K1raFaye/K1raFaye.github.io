class CQBTacticalBoard {
    constructor() {
        this.canvas = document.getElementById('tacticalCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // 多楼层系统
        this.layers = [{ id: 0, name: '1F 一楼', elements: [], gunlines: [] }];
        this.currentLayerId = 0;
        this.layerCounter = 1;
        
        // 全局设置
        this.globalSettings = {
            operatorSize: 18
        };
        
        // 实战模式
        this.combatMode = false;
        
        this.selectedElement = null;
        this.currentTool = 'operator';
        
        // 交互状态
        this.isDragging = false;
        this.isDrawing = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.drawStartX = 0;
        this.drawStartY = 0;

        // 枪线拖拽状态
        this.isDrawingGunline = false;
        this.gunlineSourcePerson = null;
        this.gunlinePreviewEnd = null;
        this.gunlinePressTimer = null;
        this.gunlinePressStart = null;

        // 移动端长按状态（枪线）
        this.mobileLongPressTimer = null;
        this.touchStartTime = 0;
        this.touchStartX = 0;
        this.touchStartY = 0;
        
        // 画板工具状态
        this.isDrawingPath = false;
        this.drawingPath = [];
        this.drawingColor = '#000000';
        this.drawingWidth = 2;
        this.currentDrawTool = 'draw';
        
        // 区域删除状态
        this.isErasingArea = false;
        this.eraseStartX = 0;
        this.eraseStartY = 0;
        
        // 智能对齐系统
        this.snapEnabled = true;
        this.snapThreshold = 8;
        this.snapPoints = [];
        
        // 视野系统开关
        this.occlusionEnabled = true;
        
        // 网格设置
        this.showGrid = true;
        this.gridSize = 20;
        
        // ID计数器
        this.idCounter = 1;

        // 撤销/重做系统
        this.historyStack = [];
        this.redoStack = [];
        this.maxHistory = 50;

        // 悬浮检测
        this.hoveredElement = null;
        this.tooltipHideTimer = null;

        this.init();
    }

    init() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        this.bindEvents();
        this.updateLayerList();
        this.saveHistory();
        this.render();
        
        // 画板工具事件
        document.getElementById('drawColor').addEventListener('input', (e) => {
            this.drawingColor = e.target.value;
        });
        document.getElementById('drawWidth').addEventListener('input', (e) => {
            this.drawingWidth = parseInt(e.target.value);
            document.getElementById('drawWidthValue').textContent = this.drawingWidth + 'px';
        });
        
        // 清空画板按钮
        document.getElementById('clearDrawBtn').addEventListener('click', () => this.clearDrawElements());
    }

    get currentElements() {
        const layer = this.layers.find(l => l.id === this.currentLayerId);
        return layer ? layer.elements : [];
    }

    get currentGunlines() {
        const layer = this.layers.find(l => l.id === this.currentLayerId);
        return layer ? layer.gunlines : [];
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.render();
    }

    bindEvents() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseLeave(e));
        this.canvas.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
        
        // 移动端触摸事件
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        
        // 移动端切换按钮
        document.getElementById('mobileToggleBtn').addEventListener('click', () => this.toggleMobileMode());
        
        // 移动端底部操作栏按钮
        document.getElementById('mobileUndoBtn').addEventListener('click', () => this.undo());
        document.getElementById('mobileRedoBtn').addEventListener('click', () => this.redo());

        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = e.currentTarget.dataset.tool;
                if (tool === 'clear') return;
                
                document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.currentTool = tool;
                
                // 画板工具特殊处理
                if (tool.startsWith('draw-')) {
                    this.currentDrawTool = tool;
                }
            });
        });

        document.getElementById('clearCanvas').addEventListener('click', () => this.clearCurrentLayer());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportImage());
        document.getElementById('gridToggle').addEventListener('click', () => this.toggleGrid());
        document.getElementById('deleteSelectedBtn').addEventListener('click', () => this.deleteSelected());

        // 门角度滑块
        document.getElementById('propDoorAngle')?.addEventListener('input', (e) => {
            if (!this.selectedElement || this.selectedElement.type !== 'door') return;
            this.selectedElement.doorAngle = parseFloat(e.target.value);
            document.getElementById('doorAngleValue').textContent = e.target.value + '°';
            this.saveHistory();
            this.render();
        });

        // 铰链位置选择器（4向）
        document.querySelectorAll('.hinge-opt').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (!this.selectedElement || this.selectedElement.type !== 'door') return;
                this.selectedElement.hingeSide = e.target.dataset.hinge;
                this.updateHingeSelectorUI();
                this.saveHistory();
                this.render();
            });
        });

        // 实战模式开关
        document.getElementById('combatModeToggle').addEventListener('change', (e) => {
            this.combatMode = e.target.checked;
            document.getElementById('modeIndicator').style.display = this.combatMode ? 'block' : 'none';
            document.getElementById('combatHint').textContent = this.combatMode ? '(已启用)' : '(敌方隐藏)';
            this.render();
        });

        // 全局设置事件
        document.getElementById('globalOperatorSize').addEventListener('input', (e) => {
            document.getElementById('operatorSizeValue').textContent = e.target.value + 'px';
        });

        document.getElementById('applySettingsBtn').addEventListener('click', () => this.applyGlobalSettings());

        document.getElementById('snapToggle').addEventListener('change', (e) => {
            this.snapEnabled = e.target.checked;
        });

        document.getElementById('occlusionToggle').addEventListener('change', (e) => {
            this.occlusionEnabled = e.target.checked;
            this.render();
        });

        document.getElementById('addLayerBtn').addEventListener('click', () => this.addLayer());

        // 删除枪线按钮
        document.getElementById('deleteGunlineBtn')?.addEventListener('click', () => this.deleteSelectedGunline());

        this.bindPropertyEvents();

        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    bindPropertyEvents() {
        const props = ['propX', 'propY', 'propWidth', 'propHeight'];
        props.forEach(id => {
            document.getElementById(id).addEventListener('change', (e) => {
                if (!this.selectedElement) return;
                const prop = id.replace('prop', '').toLowerCase();
                this.selectedElement[prop] = parseFloat(e.target.value);
                this.saveHistory();
                this.render();
            });
        });

        document.getElementById('propRotation').addEventListener('input', (e) => {
            if (!this.selectedElement || this.selectedElement.type === 'door') return;
            this.selectedElement.rotation = parseFloat(e.target.value);
            document.getElementById('rotationValue').textContent = e.target.value + '°';
            this.render();
        });

        document.getElementById('propFOV').addEventListener('input', (e) => {
            if (!this.selectedElement) return;
            this.selectedElement.fovAngle = parseFloat(e.target.value);
            document.getElementById('fovValue').textContent = e.target.value + '°';
            this.render();
        });

        document.getElementById('fovRangeType').addEventListener('change', (e) => {
            if (!this.selectedElement) return;
            this.selectedElement.fovInfinite = e.target.value === 'infinite';
            
            const rangeSlider = document.getElementById('fovRange');
            const rangeValue = document.getElementById('fovRangeValue');
            
            if (this.selectedElement.fovInfinite) {
                rangeSlider.style.display = 'none';
                rangeValue.textContent = '∞ 无限';
            } else {
                rangeSlider.style.display = 'block';
                rangeValue.textContent = this.selectedElement.fovRange + 'px';
            }
            
            this.render();
        });

        document.getElementById('fovRange').addEventListener('input', (e) => {
            if (!this.selectedElement || this.selectedElement.fovInfinite) return;
            this.selectedElement.fovRange = parseFloat(e.target.value);
            document.getElementById('fovRangeValue').textContent = e.target.value + 'px';
            this.render();
        });

        document.getElementById('propColor').addEventListener('input', (e) => {
            if (!this.selectedElement) return;
            this.selectedElement.color = e.target.value;
            this.render();
        });

        document.getElementById('propLabel').addEventListener('input', (e) => {
            if (!this.selectedElement) return;
            this.selectedElement.label = e.target.value;
            this.render();
        });

        // 人员信息字段
        document.getElementById('propPersonName')?.addEventListener('input', (e) => {
            if (!this.selectedElement) return;
            this.selectedElement.personName = e.target.value;
            this.render();
        });
        document.getElementById('propCallSign')?.addEventListener('input', (e) => {
            if (!this.selectedElement) return;
            this.selectedElement.callSign = e.target.value;
            this.render();
        });
        document.getElementById('propPosition')?.addEventListener('input', (e) => {
            if (!this.selectedElement) return;
            this.selectedElement.position = e.target.value;
            this.render();
        });

        document.getElementById('targetLayerSelect').addEventListener('change', (e) => {
            if (!this.selectedElement || this.selectedElement.type !== 'stairs') return;
            this.selectedElement.targetLayerId = parseInt(e.target.value);
        });
    }

    // ==================== 撤销/重做系统 ====================

    saveHistory() {
        const snapshot = JSON.stringify(this.layers.map(layer => ({
            id: layer.id,
            name: layer.name,
            elements: JSON.parse(JSON.stringify(layer.elements)),
            gunlines: JSON.parse(JSON.stringify(layer.gunlines))
        })));
        
        if (this.historyStack.length > 0 && this.historyStack[this.historyStack.length - 1] === snapshot) {
            return;
        }
        
        this.historyStack.push(snapshot);
        this.redoStack = [];
        if (this.historyStack.length > this.maxHistory) {
            this.historyStack.shift();
        }
    }

    undo() {
        if (this.historyStack.length <= 1) return;
        
        const current = this.historyStack.pop();
        this.redoStack.push(current);
        
        const prev = JSON.parse(this.historyStack[this.historyStack.length - 1]);
        
        this.layers.forEach(layer => {
            layer.elements = [];
            layer.gunlines = [];
        });
        
        prev.forEach(data => {
            const layer = this.layers.find(l => l.id === data.id);
            if (layer) {
                layer.name = data.name;
                layer.elements = JSON.parse(JSON.stringify(data.elements));
                layer.gunlines = JSON.parse(JSON.stringify(data.gunlines));
            }
        });
        
        this.deselectElement();
        this.render();
    }

    redo() {
        if (this.redoStack.length === 0) return;
        
        const next = this.redoStack.pop();
        this.historyStack.push(next);
        
        const data = JSON.parse(next);
        
        this.layers.forEach(layer => {
            layer.elements = [];
            layer.gunlines = [];
        });
        
        data.forEach(d => {
            const layer = this.layers.find(l => l.id === d.id);
            if (layer) {
                layer.name = d.name;
                layer.elements = JSON.parse(JSON.stringify(d.elements));
                layer.gunlines = JSON.parse(JSON.stringify(d.gunlines));
            }
        });
        
        this.deselectElement();
        this.render();
    }

    // ==================== 全局设置 ====================

    applyGlobalSettings() {
        const newSize = parseInt(document.getElementById('globalOperatorSize').value);
        
        this.layers.forEach(layer => {
            layer.elements.forEach(el => {
                if (['operator', 'hostile', 'hostage'].includes(el.type)) {
                    el.radius = newSize;
                }
            });
        });

        this.saveHistory();
        this.render();
        
        alert(`✅ 设置已应用！\n• 操作员大小: ${newSize}px`);
    }

    // ==================== 图层管理 ====================

    addLayer() {
        this.layerCounter++;
        const newLayer = {
            id: Date.now(),
            name: `${this.layerCounter}F ${this.getFloorName(this.layerCounter)}`,
            elements: [],
            gunlines: []
        };
        this.layers.push(newLayer);
        this.switchToLayer(newLayer.id);
        this.updateLayerList();
        this.saveHistory();
    }

    getFloorName(num) {
        const names = ['一楼', '二楼', '三楼', '四楼', '五楼', '六楼', '顶楼'];
        return names[num - 1] || `${num}层`;
    }

    switchToLayer(layerId) {
        this.currentLayerId = layerId;
        this.deselectElement();
        this.updateLayerList();
        this.render();
    }

    deleteLayer(layerId) {
        if (this.layers.length <= 1) {
            alert('至少需要保留一个楼层！');
            return;
        }
        
        if (!confirm(`确定要删除 "${this.getLayerNameById(layerId)}" 及其所有元素吗？`)) return;
        
        const index = this.layers.findIndex(l => l.id === layerId);
        if (index > -1) {
            this.layers.splice(index, 1);
            if (this.currentLayerId === layerId) {
                this.currentLayerId = this.layers[0].id;
            }
            this.deselectElement();
            this.updateLayerList();
            this.saveHistory();
            this.render();
        }
    }

    getLayerNameById(layerId) {
        const layer = this.layers.find(l => l.id === layerId);
        return layer ? layer.name : '';
    }

    moveLayer(layerId, direction) {
        const index = this.layers.findIndex(l => l.id === layerId);
        if (index === -1) return;

        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= this.layers.length) return;

        [this.layers[index], this.layers[newIndex]] = [this.layers[newIndex], this.layers[index]];
        
        this.updateLayerList();
    }

    renameLayer(layerId, newName) {
        const layer = this.layers.find(l => l.id === layerId);
        if (layer && newName.trim()) {
            layer.name = newName.trim();
        }
    }

    updateLayerList() {
        const listContainer = document.getElementById('layerList');
        listContainer.innerHTML = '';
        
        this.layers.forEach((layer, index) => {
            const item = document.createElement('div');
            item.className = `layer-item${layer.id === this.currentLayerId ? ' active' : ''}`;
            item.dataset.layer = layer.id;
            
            item.innerHTML = `
                <span class="layer-name" contenteditable="true" title="点击编辑名称">${layer.name}</span>
                <div class="layer-actions">
                    <button class="layer-up" data-action="up" title="上移">▲</button>
                    <button class="layer-down" data-action="down" title="下移">▼</button>
                    <button class="layer-delete" data-delete="${layer.id}" title="删除此楼层">×</button>
                </div>
            `;
            
            item.querySelector('.layer-name').addEventListener('click', (e) => {
                e.stopPropagation();
                this.switchToLayer(layer.id);
            });

            item.querySelector('.layer-name').addEventListener('blur', (e) => {
                this.renameLayer(layer.id, e.target.textContent);
            });

            item.querySelector('.layer-name').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.target.blur();
                }
            });
            
            item.querySelector('.layer-up').addEventListener('click', (e) => {
                e.stopPropagation();
                this.moveLayer(layer.id, 'up');
            });
            
            item.querySelector('.layer-down').addEventListener('click', (e) => {
                e.stopPropagation();
                this.moveLayer(layer.id, 'down');
            });
            
            item.querySelector('.layer-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteLayer(layer.id);
            });
            
            // 为整个楼层项添加点击事件，实现点击楼层框切换到对应楼层
            item.addEventListener('click', () => {
                this.switchToLayer(layer.id);
            });
            
            listContainer.appendChild(item);
        });
    }

    clearCurrentLayer() {
        if (confirm(`确定要清空 "${this.getLayerNameById(this.currentLayerId)}" 的所有元素吗？此操作不可撤销。`)) {
            const layer = this.layers.find(l => l.id === this.currentLayerId);
            if (layer) {
                layer.elements = [];
                layer.gunlines = [];
                this.deselectElement();
                this.saveHistory();
                this.render();
            }
        }
    }

    // ==================== 智能对齐系统 ====================
    
    calculateSnapPoints() {
        this.snapPoints = [];
        const elements = this.currentElements;
        
        elements.forEach(el => {
            if (el === this.selectedElement && this.isDragging) return;
            
            if (['wall', 'door', 'window', 'furniture', 'obstacle', 'stairs'].includes(el.type)) {
                this.snapPoints.push(
                    { x: el.x, y: el.y, type: 'corner' },
                    { x: el.x + el.width, y: el.y, type: 'corner' },
                    { x: el.x, y: el.y + el.height, type: 'corner' },
                    { x: el.x + el.width, y: el.y + el.height, type: 'corner' },
                    { x: el.x + el.width / 2, y: el.y, type: 'edge-center' },
                    { x: el.x + el.width / 2, y: el.y + el.height, type: 'edge-center' },
                    { x: el.x, y: el.y + el.height / 2, type: 'edge-center' },
                    { x: el.x + el.width, y: el.y + el.height / 2, type: 'edge-center' },
                    { x: el.x + el.width / 2, y: el.y + el.height / 2, type: 'center' }
                );
            }
        });
    }

    snapPosition(x, y, element) {
        if (!this.snapEnabled || !element) return { x, y, snapped: false };
        
        this.calculateSnapPoints();
        
        let snappedX = x;
        let snappedY = y;
        let snapInfo = null;
        
        for (const point of this.snapPoints) {
            if (Math.abs(x - point.x) <= this.snapThreshold) {
                snappedX = point.x;
                snapInfo = snapInfo || `X=${Math.round(point.x)}`;
                break;
            }
        }
        
        for (const point of this.snapPoints) {
            if (Math.abs(y - point.y) <= this.snapThreshold) {
                snappedY = point.y;
                snapInfo = snapInfo ? `${snapInfo}, Y=${Math.round(point.y)}` : `Y=${Math.round(point.y)}`;
                break;
            }
        }
        
        if (snapInfo && (snappedX !== x || snappedY !== y)) {
            this.showSnapIndicator(snapInfo);
        }
        
        return { x: snappedX, y: snappedY, snapped: snapInfo !== null };
    }

    showSnapIndicator(info) {
        const indicator = document.getElementById('snapIndicator');
        document.getElementById('snapInfo').textContent = info;
        indicator.style.display = 'block';
        
        clearTimeout(this.snapTimeout);
        this.snapTimeout = setTimeout(() => {
            indicator.style.display = 'none';
        }, 1500);
    }

    autoLinkWalls(newElement) {
        if (!['wall', 'door', 'window'].includes(newElement.type)) return newElement;
        
        const elements = this.currentElements.filter(el => 
            el !== newElement && ['wall', 'door', 'window'].includes(el.type)
        );
        
        for (const existing of elements) {
            if (this.canLinkHorizontal(newElement, existing)) {
                if (newElement.y < existing.y + existing.height && 
                    newElement.y + newElement.height > existing.y) {
                    if (newElement.x > existing.x) {
                        newElement.x = existing.x + existing.width;
                    } else {
                        newElement.width = existing.x - newElement.x;
                    }
                }
            }
            
            if (this.canLinkVertical(newElement, existing)) {
                if (newElement.x < existing.x + existing.width &&
                    newElement.x + newElement.width > existing.x) {
                    if (newElement.y > existing.y) {
                        newElement.y = existing.y + existing.height;
                    } else {
                        newElement.height = existing.y - newElement.y;
                    }
                }
            }
        }
        
        return newElement;
    }

    canLinkHorizontal(el1, el2) {
        return Math.abs((el1.y + el1.height / 2) - (el2.y + el2.height / 2)) < 30;
    }

    canLinkVertical(el1, el2) {
        return Math.abs((el1.x + el1.width / 2) - (el2.x + el2.width / 2)) < 30;
    }

    // ==================== 鼠标事件处理 ====================

    handleMouseDown(e) {
        if (e.button === 2) return;

        const rect = this.canvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;

        // 移动端模式下，点击空白区域切换属性面板
        const appContainer = document.querySelector('.app-container');
        if (appContainer.classList.contains('mobile')) {
            const clickedElement = this.findElementAt(x, y);
            if (!clickedElement) {
                const propertiesPanel = document.querySelector('.properties-panel');
                propertiesPanel.classList.toggle('mobile-open');
                return;
            }
        }

        // 画板工具处理
        if (this.currentTool === 'draw' || this.currentTool.startsWith('draw-')) {
            if (this.currentTool === 'draw-erase-area') {
                // 区域删除工具
                this.isErasingArea = true;
                this.eraseStartX = x;
                this.eraseStartY = y;
                return;
            }
            this.isDrawingPath = true;
            this.drawingPath = [{ x, y }];
            this.drawStartX = x;
            this.drawStartY = y;
            return;
        }

        if (this.currentTool === 'select' || this.currentTool === 'delete') {
            const clickedElement = this.findElementAt(x, y);

            if (clickedElement) {
                this.selectElement(clickedElement);
                if (this.currentTool === 'delete') {
                    this.deleteSelected();
                    return;
                }
                this.isDragging = true;
                this.dragStartX = x - clickedElement.x;
                this.dragStartY = y - clickedElement.y;
            } else {
                this.deselectElement();
            }
        } else {
            this.isDrawing = true;
            this.drawStartX = x;
            this.drawStartY = y;
        }
    }

    handleContextMenu(e) {
        e.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.currentTool !== 'select') return;

        const clickedPerson = this.findPersonAt(x, y);

        if (clickedPerson && clickedPerson.type !== 'hostage') {
            this.gunlinePressStart = Date.now();
            this.gunlineSourcePerson = clickedPerson;
            this.isDrawingGunline = false;
            this.gunlinePreviewEnd = null;
            this.gunlinePressTimer = setTimeout(() => {
                this.isDrawingGunline = true;
                document.getElementById('gunlineHint').style.display = 'block';
            }, 300);
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;

        document.getElementById('coordsDisplay').textContent = `${Math.round(x)}, ${Math.round(y)}`;

        // 检测悬浮元素（用于浮窗）
        this.checkHover(x, y);

        // 枪线拖拽中（右键长按）
        if (this.isDrawingGunline && this.gunlineSourcePerson) {
            this.gunlinePreviewEnd = { x, y };
            this.render();
            return;
        }

        // 画板工具绘制中
        if (this.isDrawingPath) {
            if (this.currentTool === 'draw') {
                this.drawingPath.push({ x, y });
                this.render();
                this.drawDrawPreview(x, y);
            } else if (this.currentTool.startsWith('draw-')) {
                this.render();
                this.drawDrawPreview(x, y);
            }
            return;
        }

        // 区域删除预览
        if (this.isErasingArea) {
            this.render();
            this.drawErasePreview(x, y);
            return;
        }

        if (this.isDragging && this.selectedElement) {
            const newPos = this.snapPosition(
                x - this.dragStartX,
                y - this.dragStartY,
                this.selectedElement
            );
            
            this.selectedElement.x = newPos.x;
            this.selectedElement.y = newPos.y;
            this.updatePropertyPanel();
            this.render();
        }

        if (this.isDrawing) {
            this.render();
            
            if (this.snapEnabled) {
                const snapped = this.snapPosition(x, y, null);
                this.drawPreview(snapped.x, snapped.y);
            } else {
                this.drawPreview(x, y);
            }
        }
    }

    handleMouseUp(e) {
        // 右键松开 → 完成枪线
        if (e.button === 2) {
            if (this.isDrawingGunline && this.gunlineSourcePerson && this.gunlinePreviewEnd) {
                const layer = this.layers.find(l => l.id === this.currentLayerId);
                if (layer) {
                    layer.gunlines.push({
                        id: this.idCounter++,
                        fromX: this.gunlineSourcePerson.x,
                        fromY: this.gunlineSourcePerson.y,
                        toX: this.gunlinePreviewEnd.x,
                        toY: this.gunlinePreviewEnd.y,
                        sourceType: this.gunlineSourcePerson.type,
                        sourceId: this.gunlineSourcePerson.id,
                        color: this.gunlineSourcePerson.color
                    });
                    this.saveHistory();
                }
            }
            this.isDrawingGunline = false;
            if (this.gunlinePressTimer) {
                clearTimeout(this.gunlinePressTimer);
                this.gunlinePressTimer = null;
            }
            this.gunlineSourcePerson = null;
            this.gunlinePreviewEnd = null;
            document.getElementById('gunlineHint').style.display = 'none';
            this.render();
            return;
        }

        // 画板工具完成绘制
        if (this.isDrawingPath) {
            const rect = this.canvas.getBoundingClientRect();
            let x = e.clientX - rect.left;
            let y = e.clientY - rect.top;
            
            const layer = this.layers.find(l => l.id === this.currentLayerId);
            if (layer) {
                if (this.currentTool === 'draw') {
                    // 自由绘制
                    if (this.drawingPath.length > 1) {
                        layer.elements.push({
                            id: this.idCounter++,
                            type: 'draw-path',
                            path: JSON.parse(JSON.stringify(this.drawingPath)),
                            color: this.drawingColor,
                            lineWidth: this.drawingWidth
                        });
                        this.saveHistory();
                    }
                } else if (this.currentTool === 'draw-rect') {
                    // 矩形
                    const dx = Math.min(this.drawStartX, x);
                    const dy = Math.min(this.drawStartY, y);
                    const dw = Math.abs(x - this.drawStartX);
                    const dh = Math.abs(y - this.drawStartY);
                    
                    if (dw > 5 && dh > 5) {
                        layer.elements.push({
                            id: this.idCounter++,
                            type: 'draw-rect',
                            x: dx,
                            y: dy,
                            width: dw,
                            height: dh,
                            color: this.drawingColor,
                            lineWidth: this.drawingWidth
                        });
                        this.saveHistory();
                    }
                } else if (this.currentTool === 'draw-circle') {
                    // 圆形
                    const radius = Math.sqrt(
                        Math.pow(x - this.drawStartX, 2) + Math.pow(y - this.drawStartY, 2)
                    );
                    
                    if (radius > 5) {
                        layer.elements.push({
                            id: this.idCounter++,
                            type: 'draw-circle',
                            x: this.drawStartX,
                            y: this.drawStartY,
                            radius: radius,
                            color: this.drawingColor,
                            lineWidth: this.drawingWidth
                        });
                        this.saveHistory();
                    }
                } else if (this.currentTool === 'draw-line') {
                    // 直线
                    const dx = x - this.drawStartX;
                    const dy = y - this.drawStartY;
                    const length = Math.sqrt(dx * dx + dy * dy);
                    
                    if (length > 5) {
                        layer.elements.push({
                            id: this.idCounter++,
                            type: 'draw-line',
                            x1: this.drawStartX,
                            y1: this.drawStartY,
                            x2: x,
                            y2: y,
                            color: this.drawingColor,
                            lineWidth: this.drawingWidth
                        });
                        this.saveHistory();
                    }
                }
            }
            
            this.isDrawingPath = false;
            this.drawingPath = [];
            this.render();
            return;
        }

        // 区域删除完成
        if (this.isErasingArea) {
            const rect = this.canvas.getBoundingClientRect();
            let x = e.clientX - rect.left;
            let y = e.clientY - rect.top;
            
            const layer = this.layers.find(l => l.id === this.currentLayerId);
            if (layer) {
                const eraseArea = {
                    x: Math.min(this.eraseStartX, x),
                    y: Math.min(this.eraseStartY, y),
                    width: Math.abs(x - this.eraseStartX),
                    height: Math.abs(y - this.eraseStartY)
                };
                
                // 过滤掉在删除区域内的画板元素
                const elementsToKeep = layer.elements.filter(el => {
                    if (!el.type.startsWith('draw-')) return true;
                    
                    // 检查不同类型的画板元素是否在删除区域内
                    if (el.type === 'draw-rect') {
                        return !this.rectIntersects({
                            x: el.x, y: el.y, width: el.width, height: el.height
                        }, eraseArea);
                    } else if (el.type === 'draw-circle') {
                        return !this.circleIntersectsRect(el, eraseArea);
                    } else if (el.type === 'draw-line') {
                        return !this.lineIntersectsRect(el, eraseArea);
                    } else if (el.type === 'draw-path') {
                        return !this.pathIntersectsRect(el, eraseArea);
                    }
                    return true;
                });
                
                if (elementsToKeep.length !== layer.elements.length) {
                    layer.elements = elementsToKeep;
                    this.saveHistory();
                }
            }
            
            this.isErasingArea = false;
            this.render();
            return;
        }

        // 左键松开 → 清理可能的右键长按残留（不应发生但防御性处理）
        if (this.gunlinePressTimer) {
            clearTimeout(this.gunlinePressTimer);
            this.gunlinePressTimer = null;
            this.gunlineSourcePerson = null;
        }

        if (this.isDrawing) {
            const rect = this.canvas.getBoundingClientRect();
            let x = e.clientX - rect.left;
            let y = e.clientY - rect.top;
            
            if (this.snapEnabled) {
                const snapped = this.snapPosition(x, y, null);
                x = snapped.x;
                y = snapped.y;
            }
            
            this.createElement(this.drawStartX, this.drawStartY, x, y);
        }

        if (this.isDragging) {
            this.saveHistory();
        }

        this.isDragging = false;
        this.isDrawing = false;
    }

    handleMouseLeave(e) {
        if (this.gunlinePressTimer) {
            clearTimeout(this.gunlinePressTimer);
            this.gunlinePressTimer = null;
            this.gunlineSourcePerson = null;
        }
        if (this.isDrawingGunline) {
            this.isDrawingGunline = false;
            this.gunlineSourcePerson = null;
            this.gunlinePreviewEnd = null;
            document.getElementById('gunlineHint').style.display = 'none';
        }
        
        // 清理画板工具状态
        if (this.isDrawingPath) {
            this.isDrawingPath = false;
            this.drawingPath = [];
        }

        this.hideTooltip();

        if (this.isDrawing) {
            this.handleMouseUp(e);
        }
    }

    // ==================== 悬浮检测与浮窗 ====================

    checkHover(x, y) {
        const person = this.findPersonAt(x, y);
        if (person && person !== this.selectedElement) {
            if (this.hoveredElement !== person) {
                this.hoveredElement = person;
                this.showTooltip(person, x, y);
            } else {
                this.updateTooltipPosition(x, y);
            }
        } else {
            this.hideTooltip();
            this.hoveredElement = null;
        }
    }

    showTooltip(person, x, y) {
        const tooltip = document.getElementById('personTooltip');
        const header = document.getElementById('tooltipHeader');
        const body = document.getElementById('tooltipBody');

        const typeNames = { operator: '👤 操作员', hostile: '💀 敌人', hostage: '🙋 人质' };
        header.textContent = typeNames[person.type] || person.type;

        let html = '';
        if (person.personName) {
            html += `<div class="tooltip-row"><span class="tooltip-label">名称</span><span class="tooltip-value">${person.personName}</span></div>`;
        }
        if (person.callSign) {
            html += `<div class="tooltip-row"><span class="tooltip-label">呼号</span><span class="tooltip-value">${person.callSign}</span></div>`;
        }
        if (person.position) {
            html += `<div class="tooltip-row"><span class="tooltip-label">职位</span><span class="tooltip-value">${person.position}</span></div>`;
        }
        html += `<div class="tooltip-row"><span class="tooltip-label">FOV</span><span class="tooltip-value">${person.fovAngle}°${person.fovInfinite ? ' ∞' : ' '+person.fovRange+'px'}</span></div>`;

        body.innerHTML = html || '<span style="color:#888">暂无信息</span>';
        tooltip.style.display = 'block';
        this.updateTooltipPosition(x, y);

        clearTimeout(this.tooltipHideTimer);
    }

    updateTooltipPosition(x, y) {
        const tooltip = document.getElementById('personTooltip');
        const canvasRect = this.canvas.getBoundingClientRect();
        tooltip.style.left = (x + canvasRect.left + 15) + 'px';
        tooltip.style.top = (y + canvasRect.top + 15) + 'px';
    }

    hideTooltip() {
        clearTimeout(this.tooltipHideTimer);
        this.tooltipHideTimer = setTimeout(() => {
            document.getElementById('personTooltip').style.display = 'none';
        }, 100);
    }

    handleKeyboard(e) {
        if (document.activeElement.tagName === 'INPUT') return;
        
        if (e.key === 'Delete' || e.key === 'Backspace') {
            this.deleteSelected();
        } else if (e.key === 'Escape') {
            this.deselectElement();
        } else if (e.key === 'g' || e.key === 'G') {
            this.toggleGrid();
        } else if (e.key === 's' || e.key === 'S') {
            if (e.ctrlKey) {
                e.preventDefault();
                this.exportImageNoUI();
            } else {
                const toggle = document.getElementById('snapToggle');
                toggle.checked = !toggle.checked;
                this.snapEnabled = toggle.checked;
            }
        } else if (e.key === 'o' || e.key === 'O') {
            const toggle = document.getElementById('occlusionToggle');
            toggle.checked = !toggle.checked;
            this.occlusionEnabled = toggle.checked;
            this.render();
        } else if (e.key === 'd' || e.key === 'D') {
            if (!e.ctrlKey && this.selectedElement && this.selectedElement.type === 'door') {
                const door = this.selectedElement;
                door.doorAngle = ((door.doorAngle || 0) + 15) % 360;
                document.getElementById('propDoorAngle').value = door.doorAngle;
                document.getElementById('doorAngleValue').textContent = door.doorAngle + '°';
                this.saveHistory();
                this.render();
            }
        } else if (e.key === 'm' || e.key === 'M') {
            if (!e.ctrlKey) {
                const toggle = document.getElementById('combatModeToggle');
                toggle.checked = !toggle.checked;
                this.combatMode = toggle.checked;
                document.getElementById('modeIndicator').style.display = this.combatMode ? 'block' : 'none';
                this.render();
            }
        } else if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            this.undo();
        } else if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            this.redo();
        }
    }

    // ==================== 元素创建与管理 ====================

    createElement(x1, y1, x2, y2) {
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);
        
        if (width < 10 && height < 10) {
            const element = this.createDefaultElement(x1, y1);
            if (element) {
                if (this.snapEnabled) {
                    this.autoLinkWalls(element);
                }
                
                this.currentElements.push(element);
                this.selectElement(element);
                this.saveHistory();
                this.render();
            }
        } else {
            const element = this.createElementWithSize(
                Math.min(x1, x2),
                Math.min(y1, y2),
                width,
                height
            );
            if (element) {
                if (this.snapEnabled) {
                    this.autoLinkWalls(element);
                }
                
                this.currentElements.push(element);
                this.selectElement(element);
                this.saveHistory();
                this.render();
            }
        }
    }

    createDefaultElement(x, y) {
        const baseConfig = {
            id: this.idCounter++,
            x: x,
            y: y,
            rotation: 0,
            label: '',
            personName: ''
        };

        switch (this.currentTool) {
            case 'wall':
                return { ...baseConfig, type: 'wall', width: 120, height: 15, color: '#7f8c8d' };
            case 'door':
                return { 
                    ...baseConfig, 
                    type: 'door', 
                    width: 55, 
                    height: 6, 
                    color: '#f39c12',
                    doorAngle: 0,
                    hingeSide: 'left'
                };
            case 'window':
                return { ...baseConfig, type: 'window', width: 60, height: 6, color: '#87ceeb' };
            case 'stairs':
                return { 
                    ...baseConfig, 
                    type: 'stairs', 
                    width: 60, 
                    height: 80, 
                    color: '#9b59b6',
                    targetLayerId: null 
                };
            case 'furniture':
            case 'obstacle':
                const shape = document.getElementById('obstacleShape')?.value || 'rectangle';
                return { 
                    ...baseConfig, 
                    type: 'obstacle', 
                    width: 60, 
                    height: 40, 
                    color: '#8b4513',
                    shape: shape
                };
            case 'operator':
                return { 
                    ...baseConfig, 
                    type: 'operator', 
                    radius: this.globalSettings.operatorSize, 
                    color: '#3498db', 
                    fovAngle: 120, 
                    fovRange: 9999, 
                    fovInfinite: true,
                    callSign: '',
                    position: ''
                };
            case 'hostile':
                return { 
                    ...baseConfig, 
                    type: 'hostile', 
                    radius: this.globalSettings.operatorSize - 2, 
                    color: '#e74c3c', 
                    fovAngle: 120, 
                    fovRange: 9999, 
                    fovInfinite: true 
                };
            case 'hostage':
                return { 
                    ...baseConfig, 
                    type: 'hostage', 
                    radius: this.globalSettings.operatorSize - 4, 
                    color: '#2ecc71', 
                    fovAngle: 30, 
                    fovRange: 20, 
                    fovInfinite: false 
                };
            default:
                return null;
        }
    }

    createElementWithSize(x, y, width, height) {
        const baseConfig = {
            id: this.idCounter++,
            x: x,
            y: y,
            width: width,
            height: height,
            rotation: 0,
            label: '',
            personName: ''
        };

        switch (this.currentTool) {
            case 'wall':
                return { ...baseConfig, type: 'wall', color: '#7f8c8d' };
            case 'door':
                return { ...baseConfig, type: 'door', color: '#f39c12', doorAngle: 0, hingeSide: 'left' };
            case 'window':
                return { ...baseConfig, type: 'window', color: '#87ceeb' };
            case 'stairs':
                return { ...baseConfig, type: 'stairs', color: '#9b59b6', targetLayerId: null };
            case 'furniture':
            case 'obstacle':
                const shape = document.getElementById('obstacleShape')?.value || 'rectangle';
                return { ...baseConfig, type: 'obstacle', color: '#8b4513', shape: shape };
            default:
                return this.createDefaultElement(x + width/2, y + height/2);
        }
    }

    findPersonAt(x, y) {
        const elements = this.currentElements;
        for (let i = elements.length - 1; i >= 0; i--) {
            const el = elements[i];
            if (['operator', 'hostile', 'hostage'].includes(el.type)) {
                const dist = Math.sqrt((x - el.x) ** 2 + (y - el.y) ** 2);
                if (dist <= el.radius) return el;
            }
        }
        return null;
    }

    findElementAt(x, y) {
        // 先检查枪线
        const gls = this.currentGunlines;
        for (let i = gls.length - 1; i >= 0; i--) {
            const gl = gls[i];
            if (this.pointNearLine(x, y, gl.fromX, gl.fromY, gl.toX, gl.toY, 8)) {
                return { ...gl, type: 'gunline', _gunlineIndex: i };
            }
        }

        const elements = this.currentElements;
        for (let i = elements.length - 1; i >= 0; i--) {
            const el = elements[i];
            if (['operator', 'hostile', 'hostage'].includes(el.type)) {
                const dist = Math.sqrt((x - el.x) ** 2 + (y - el.y) ** 2);
                if (dist <= el.radius) return el;
            } else if (el.type === 'draw-rect') {
                // 画板矩形
                if (x >= el.x && x <= el.x + el.width &&
                    y >= el.y && y <= el.y + el.height) {
                    return el;
                }
            } else if (el.type === 'draw-circle') {
                // 画板圆形
                const dist = Math.sqrt((x - el.x) ** 2 + (y - el.y) ** 2);
                if (dist <= el.radius) return el;
            } else if (el.type === 'draw-line') {
                // 画板直线
                if (this.pointNearLine(x, y, el.x1, el.y1, el.x2, el.y2, 8)) {
                    return el;
                }
            } else if (el.type === 'draw-path') {
                // 画板路径
                for (let j = 0; j < el.path.length - 1; j++) {
                    const p1 = el.path[j];
                    const p2 = el.path[j + 1];
                    if (this.pointNearLine(x, y, p1.x, p1.y, p2.x, p2.y, 8)) {
                        return el;
                    }
                }
            } else {
                if (x >= el.x && x <= el.x + el.width &&
                    y >= el.y && y <= el.y + el.height) {
                    return el;
                }
            }
        }
        return null;
    }

    pointNearLine(px, py, x1, y1, x2, y2, threshold) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = lenSq !== 0 ? dot / lenSq : -1;
        let xx, yy;
        if (param < 0) { xx = x1; yy = y1; }
        else if (param > 1) { xx = x2; yy = y2; }
        else { xx = x1 + param * C; yy = y1 + param * D; }
        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy) <= threshold;
    }

    selectElement(element) {
        this.selectedElement = element;
        document.getElementById('noSelection').style.display = 'none';
        document.getElementById('elementProperties').style.display = 'block';
        this.updatePropertyPanel();
        this.render();
    }

    deselectElement() {
        this.selectedElement = null;
        document.getElementById('noSelection').style.display = 'block';
        document.getElementById('elementProperties').style.display = 'none';
        this.render();
    }

    updatePropertyPanel() {
        if (!this.selectedElement) return;

        const el = this.selectedElement;
        const isGunline = el.type === 'gunline';

        document.getElementById('propType').textContent = isGunline ? '枪线' : this.getTypeName(el.type);
        document.getElementById('propX').value = Math.round(el.x);
        document.getElementById('propY').value = Math.round(el.y);

        const isPerson = ['operator', 'hostile', 'hostage'].includes(el.type);
        const isStructure = ['wall', 'door', 'window', 'furniture', 'obstacle', 'stairs'].includes(el.type);

        // 基础属性显示控制
        document.getElementById('sizeGroup').style.display = (isStructure && !isGunline) ? 'flex' : 'none';
        document.getElementById('heightGroup').style.display = (isStructure && !isGunline) ? 'flex' : 'none';
        document.getElementById('rotationGroup').style.display = (isGunline || el.type === 'door') ? 'none' : 'flex';
        document.getElementById('fovGroup').style.display = isPerson ? 'flex' : 'none';
        document.getElementById('fovRangeGroup').style.display = isPerson ? 'flex' : 'none';
        document.getElementById('colorGroup').style.display = isGunline ? 'none' : 'flex';
        document.getElementById('linkGroup').style.display = el.type === 'stairs' ? 'flex' : 'none';

        // 门控制
        document.getElementById('doorAngleGroup').style.display = el.type === 'door' ? 'flex' : 'none';
        document.getElementById('hingeGroup').style.display = el.type === 'door' ? 'flex' : 'none';
        if (el.type === 'door') {
            document.getElementById('propDoorAngle').value = el.doorAngle || 0;
            document.getElementById('doorAngleValue').textContent = (el.doorAngle || 0) + '°';
            this.updateHingeSelectorUI();
        }

        // 人员信息模块
        document.getElementById('personInfoGroup').style.display = isPerson ? 'flex' : 'none';
        if (isPerson) {
            document.getElementById('propPersonName').value = el.personName || '';
            const callSignInput = document.getElementById('propCallSign');
            const positionInput = document.getElementById('propPosition');
            if (el.type === 'operator') {
                callSignInput.style.display = 'block';
                callSignInput.value = el.callSign || '';
                positionInput.style.display = 'block';
                positionInput.value = el.position || '';
            } else {
                callSignInput.style.display = 'none';
                positionInput.style.display = 'none';
            }
        }

        // 枪线信息
        document.getElementById('gunlineGroup').style.display = isGunline ? 'flex' : 'none';

        if (isStructure && !isGunline) {
            document.getElementById('propWidth').value = Math.round(el.width);
            document.getElementById('propHeight').value = Math.round(el.height);
        }

        document.getElementById('propRotation').value = el.rotation || 0;
        document.getElementById('rotationValue').textContent = (el.rotation || 0) + '°';

        if (isPerson) {
            document.getElementById('propFOV').value = el.fovAngle;
            document.getElementById('fovValue').textContent = el.fovAngle + '°';
            
            const rangeTypeSelect = document.getElementById('fovRangeType');
            const rangeSlider = document.getElementById('fovRange');
            const rangeValue = document.getElementById('fovRangeValue');
            
            rangeTypeSelect.value = el.fovInfinite ? 'infinite' : 'finite';
            
            if (el.fovInfinite) {
                rangeSlider.style.display = 'none';
                rangeValue.textContent = '∞ 无限';
            } else {
                rangeSlider.style.display = 'block';
                rangeSlider.value = el.fovRange;
                rangeValue.textContent = el.fovRange + 'px';
            }
        }

        document.getElementById('propColor').value = el.color;
        document.getElementById('propLabel').value = el.label || '';

        if (el.type === 'stairs') {
            const targetSelect = document.getElementById('targetLayerSelect');
            targetSelect.innerHTML = '<option value="">未设置</option>';
            
            this.layers.filter(l => l.id !== this.currentLayerId).forEach(layer => {
                const option = document.createElement('option');
                option.value = layer.id;
                option.textContent = layer.name;
                if (el.targetLayerId === layer.id) option.selected = true;
                targetSelect.appendChild(option);
            });
        }
    }

    updateHingeSelectorUI() {
        if (!this.selectedElement || this.selectedElement.type !== 'door') return;
        const side = this.selectedElement.hingeSide || 'left';
        document.querySelectorAll('.hinge-opt').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.hinge === side);
        });
    }

    getTypeName(type) {
        const names = {
            wall: '墙体',
            door: '门',
            window: '窗户',
            stairs: '楼梯',
            furniture: '遮挡物',
            obstacle: '遮挡物',
            operator: '操作员',
            hostile: '敌对目标',
            hostage: '人质',
            gunline: '枪线',
            'draw-path': '自由绘制',
            'draw-rect': '矩形',
            'draw-circle': '圆形',
            'draw-line': '直线'
        };
        return names[type] || type;
    }

    deleteSelected() {
        if (!this.selectedElement) return;

        // 如果是枪线
        if (this.selectedElement.type === 'gunline') {
            this.deleteSelectedGunline();
            return;
        }

        const index = this.currentElements.indexOf(this.selectedElement);
        if (index > -1) {
            this.currentElements.splice(index, 1);
            this.saveHistory();
            this.deselectElement();
        }
    }

    deleteSelectedGunline() {
        if (!this.selectedElement || this.selectedElement.type !== 'gunline') return;
        const idx = this.selectedElement._gunlineIndex;
        if (idx !== undefined) {
            const layer = this.layers.find(l => l.id === this.currentLayerId);
            if (layer && layer.gunlines[idx]) {
                layer.gunlines.splice(idx, 1);
                this.saveHistory();
                this.deselectElement();
            }
        }
    }

    toggleGrid() {
        this.showGrid = !this.showGrid;
        document.getElementById('gridToggle').classList.toggle('active', this.showGrid);
        this.render();
    }

    exportImage() {
        const link = document.createElement('a');
        link.download = `cqb-simulator-${Date.now()}.png`;
        link.href = this.canvas.toDataURL('image/png');
        link.click();
    }
    
    exportImageNoUI() {
        const coordsDisplay = document.getElementById('coordsDisplay');
        const snapIndicator = document.getElementById('snapIndicator');
        const modeIndicator = document.getElementById('modeIndicator');
        const personTooltip = document.getElementById('personTooltip');
        const gunlineHint = document.getElementById('gunlineHint');
        
        const originalCoordsDisplay = coordsDisplay.parentElement.style.display;
        const originalSnapIndicator = snapIndicator.style.display;
        const originalModeIndicator = modeIndicator.style.display;
        const originalPersonTooltip = personTooltip.style.display;
        const originalGunlineHint = gunlineHint.style.display;
        
        coordsDisplay.parentElement.style.display = 'none';
        snapIndicator.style.display = 'none';
        modeIndicator.style.display = 'none';
        personTooltip.style.display = 'none';
        gunlineHint.style.display = 'none';
        
        this.render();
        
        const link = document.createElement('a');
        link.download = `cqb-simulator-no-ui-${Date.now()}.png`;
        link.href = this.canvas.toDataURL('image/png');
        link.click();
        
        coordsDisplay.parentElement.style.display = originalCoordsDisplay;
        snapIndicator.style.display = originalSnapIndicator;
        modeIndicator.style.display = originalModeIndicator;
        personTooltip.style.display = originalPersonTooltip;
        gunlineHint.style.display = originalGunlineHint;
        
        this.render();
    }
    
    // 切换桌面端/移动端模式
    toggleMobileMode() {
        const appContainer = document.querySelector('.app-container');
        const propertiesPanel = document.querySelector('.properties-panel');
        const toggleBtn = document.getElementById('mobileToggleBtn');
        const mobileBottomBar = document.querySelector('.mobile-bottom-bar');
        
        const isMobile = appContainer.classList.toggle('mobile');
        
        if (isMobile) {
            toggleBtn.textContent = '💻 桌面端';
            toggleBtn.classList.add('mobile');
            // 移动端默认隐藏属性面板
            propertiesPanel.classList.remove('mobile-open');
            // 显示移动端底部操作栏
            mobileBottomBar.style.display = 'flex';
            // 显示手势提示
            this.showMobileGestureHint();
        } else {
            toggleBtn.textContent = '📱 移动端';
            toggleBtn.classList.remove('mobile');
            // 桌面端默认隐藏属性面板
            propertiesPanel.classList.remove('mobile-open');
            // 隐藏移动端底部操作栏
            mobileBottomBar.style.display = 'none';
        }
        
        this.resizeCanvas();
    }

    showMobileGestureHint() {
        const hint = document.createElement('div');
        hint.className = 'mobile-gesture-hint';
        hint.textContent = '单指：选择/拖动/绘制\n 长按人物：拖出枪线\n选中后删除按钮：删除';
        document.body.appendChild(hint);
        
        setTimeout(() => {
            hint.remove();
        }, 3000);
    }

    // 移动端触摸事件处理
    handleTouchStart(e) {
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();

        if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
            touch.clientY >= rect.top && touch.clientY <= rect.bottom) {

            e.preventDefault();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            if (e.touches.length === 1) {
                this.touchStartTime = Date.now();
                this.touchStartX = x;
                this.touchStartY = y;

                const clickedElement = this.findElementAt(x, y);

                if (clickedElement && (clickedElement.type === 'operator' || clickedElement.type === 'hostile')) {
                    this.selectElement(clickedElement);
                    this.isDragging = true;
                    this.dragStartX = x - clickedElement.x;
                    this.dragStartY = y - clickedElement.y;

                    this.gunlineSourcePerson = clickedElement;
                    this.isDrawingGunline = false;
                    this.gunlinePreviewEnd = null;

                    clearTimeout(this.mobileLongPressTimer);
                    this.mobileLongPressTimer = setTimeout(() => {
                        this.isDrawingGunline = true;
                        this.isDragging = false;
                        this.render();
                    }, 350);
                } else if (clickedElement) {
                    this.selectElement(clickedElement);
                    this.isDragging = true;
                    this.dragStartX = x - clickedElement.x;
                    this.dragStartY = y - clickedElement.y;
                } else {
                    this.deselectElement();
                    this.isDrawing = true;
                    this.drawStartX = x;
                    this.drawStartY = y;
                }
            }
        }
    }

    handleTouchMove(e) {
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();

        if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
            touch.clientY >= rect.top && touch.clientY <= rect.bottom) {

            e.preventDefault();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            if (e.touches.length === 1) {
                const movedDist = Math.sqrt(Math.pow(x - this.touchStartX, 2) + Math.pow(y - this.touchStartY, 2));

                if (movedDist > 10 && !this.isDrawingGunline && this.mobileLongPressTimer) {
                    clearTimeout(this.mobileLongPressTimer);
                    this.mobileLongPressTimer = null;
                }

                if (this.isDrawingGunline) {
                    this.gunlinePreviewEnd = { x, y };
                    this.render();
                } else if (this.isDragging && this.selectedElement) {
                    const newPos = this.snapPosition(
                        x - this.dragStartX,
                        y - this.dragStartY,
                        this.selectedElement
                    );
                    this.selectedElement.x = newPos.x;
                    this.selectedElement.y = newPos.y;
                    this.updatePropertyPanel();
                    this.render();
                } else if (this.isDrawing) {
                    this.render();
                    if (this.snapEnabled) {
                        const snapped = this.snapPosition(x, y, null);
                        this.drawPreview(snapped.x, snapped.y);
                    } else {
                        this.drawPreview(x, y);
                    }
                }
            }
        }
    }

    handleTouchEnd(e) {
        if (e.touches.length === 0 && e.changedTouches.length === 1) {
            const touch = e.changedTouches[0];
            const rect = this.canvas.getBoundingClientRect();

            if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
                touch.clientY >= rect.top && touch.clientY <= rect.bottom) {

                e.preventDefault();

                if (this.isDrawingGunline && this.gunlineSourcePerson && this.gunlinePreviewEnd) {
                    const layer = this.layers.find(l => l.id === this.currentLayerId);
                    if (layer) {
                        layer.gunlines.push({
                            id: this.idCounter++,
                            fromX: this.gunlineSourcePerson.x,
                            fromY: this.gunlineSourcePerson.y,
                            toX: this.gunlinePreviewEnd.x,
                            toY: this.gunlinePreviewEnd.y,
                            sourceType: this.gunlineSourcePerson.type,
                            sourceId: this.gunlineSourcePerson.id,
                            color: this.gunlineSourcePerson.color
                        });
                        this.saveHistory();
                    }
                }

                if (!this.isDrawingGunline && this.isDrawing) {
                    const x = touch.clientX - rect.left;
                    const y = touch.clientY - rect.top;
                    if (this.snapEnabled) {
                        const snapped = this.snapPosition(x, y, null);
                        this.createElement(this.drawStartX, this.drawStartY, snapped.x, snapped.y);
                    } else {
                        this.createElement(this.drawStartX, this.drawStartY, x, y);
                    }
                }

                if (this.isDragging && !this.isDrawingGunline) {
                    this.saveHistory();
                }

                clearTimeout(this.mobileLongPressTimer);
                this.mobileLongPressTimer = null;
                this.isDrawingGunline = false;
                this.gunlineSourcePerson = null;
                this.gunlinePreviewEnd = null;
                this.isDragging = false;
                this.isDrawing = false;
                this.render();
            }
        }
    }

    drawPreview(x, y) {
        this.ctx.save();
        this.ctx.strokeStyle = '#e94560';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.fillStyle = 'rgba(233, 69, 96, 0.1)';

        if (['operator', 'hostile', 'hostage'].includes(this.currentTool)) {
            this.ctx.beginPath();
            this.ctx.arc(this.drawStartX, this.drawStartY, this.globalSettings.operatorSize, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        } else if (this.currentTool === 'door') {
            const w = x - this.drawStartX;
            const h = y - this.drawStartY;
            const dx = Math.min(this.drawStartX, x);
            const dy = Math.min(this.drawStartY, y);
            const dw = Math.abs(w);
            const dh = Math.abs(h);

            this.ctx.fillStyle = 'rgba(243, 156, 18, 0.25)';
            this.ctx.fillRect(dx, dy, dw, dh);
            this.ctx.strokeStyle = '#f39c12';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([4, 4]);
            this.ctx.strokeRect(dx, dy, dw, dh);

            // 预览铰链弧线
            this.ctx.beginPath();
            this.ctx.arc(dx, dy + dh / 2, dw, -Math.PI / 2, 0);
            this.ctx.strokeStyle = 'rgba(243, 156, 18, 0.35)';
            this.ctx.lineWidth = 1.5;
            this.ctx.setLineDash([6, 4]);
            this.ctx.stroke();

            this.ctx.fillStyle = '#f39c12';
            this.ctx.beginPath();
            this.ctx.arc(dx, dy + dh / 2, 4, 0, Math.PI * 2);
            this.ctx.fill();
        } else {
            const w = x - this.drawStartX;
            const h = y - this.drawStartY;
            this.ctx.fillRect(this.drawStartX, this.drawStartY, w, h);
            this.ctx.strokeRect(this.drawStartX, this.drawStartY, w, h);
        }

        this.ctx.restore();
    }

    // ==================== 实战模式：检测单位是否在视野内 ====================

    isInOperatorFOV(targetPerson) {
        const operators = this.currentElements.filter(el => el.type === 'operator' && el.fovAngle);
        
        for (const op of operators) {
            const dist = Math.sqrt(
                (op.x - targetPerson.x) ** 2 + (op.y - targetPerson.y) ** 2
            );

            const maxDist = op.fovInfinite ? 9999 : op.fovRange;
            
            if (dist > maxDist) continue;

            const baseAngle = ((op.rotation || 0) - 90) * Math.PI / 180;
            const halfFov = (op.fovAngle / 2) * Math.PI / 180;
            
            const dx = targetPerson.x - op.x;
            const dy = targetPerson.y - op.y;
            const angleToTarget = Math.atan2(dy, dx);
            
            let angleDiff = angleToTarget - baseAngle;
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            
            if (Math.abs(angleDiff) <= halfFov) {
                if (!this.isLineOfSightBlocked(op, targetPerson)) {
                    return true;
                }
            }
        }
        
        return false;
    }

    isLineOfSightBlocked(from, to) {
        if (!this.occlusionEnabled) return false;
        
        const obstacles = this.getObstacles();
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist === 0) return false;
        
        const dirX = dx / dist;
        const dirY = dy / dist;
        
        for (const obs of obstacles) {
            let hitDist;
            if (obs.type === 'door') {
                hitDist = this.raycastRotatedDoor(from.x, from.y, dirX, dirY, obs);
            } else if (obs.type === 'obstacle' && obs.shape === 'circle') {
                hitDist = this.raycastCircle(from.x, from.y, dirX, dirY, obs);
            } else {
                hitDist = this.raycastRect(from.x, from.y, dirX, dirY, obs);
            }
            if (hitDist !== null && hitDist < dist) {
                return true;
            }
        }
        
        return false;
    }

    // ==================== 渲染系统 ====================

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#0d1117';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.showGrid) {
            this.drawGrid();
        }

        this.drawLayerInfo();

        // 第1步：绘制建筑元素（始终显示）
        this.currentElements.filter(el => 
            !['operator', 'hostile', 'hostage'].includes(el.type) && !el.type.startsWith('draw-')
        ).forEach(el => this.drawElement(el));

        // 第1.5步：绘制画板元素（始终显示）
        this.currentElements.filter(el => el.type.startsWith('draw-')).forEach(el => {
            this.drawDrawElement(el);
        });

        // 第2步：根据实战模式决定显示哪些人员
        if (this.combatMode) {
            this.currentElements.forEach(el => {
                if (el.type === 'operator') {
                    this.drawPersonWithOccludedFOV(el);
                    this.drawPerson(el);
                } else if (['hostile', 'hostage'].includes(el.type)) {
                    if (this.isInOperatorFOV(el)) {
                        this.drawPersonWithOccludedFOV(el);
                        this.drawPerson(el);
                    }
                }
            });
        } else {
            this.currentElements.filter(el => 
                ['operator', 'hostile', 'hostage'].includes(el.type)
            ).forEach(el => {
                this.drawPersonWithOccludedFOV(el);
                this.drawPerson(el);
            });
        }

        // 第3步：绘制枪线
        this.currentGunlines.forEach(gl => this.drawGunline(gl));

        // 第4步：绘制枪线预览
        if (this.isDrawingGunline && this.gunlineSourcePerson && this.gunlinePreviewEnd) {
            this.drawGunlinePreview(this.gunlineSourcePerson, this.gunlinePreviewEnd);
        }

        // 第5步：绘制选中框
        if (this.selectedElement) {
            this.drawSelectionBox(this.selectedElement);
        }
    }

    drawGrid() {
        this.ctx.save();
        this.ctx.strokeStyle = '#1a2332';
        this.ctx.lineWidth = 0.5;

        for (let x = 0; x < this.canvas.width; x += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        for (let y = 0; y < this.canvas.height; y += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }

        this.ctx.restore();
    }

    drawLayerInfo() {
        const currentLayer = this.layers.find(l => l.id === this.currentLayerId);
        if (!currentLayer) return;

        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 217, 255, 0.15)';
        this.ctx.fillRect(10, 10, 140, 35);
        
        this.ctx.strokeStyle = '#00d9ff';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(10, 10, 140, 35);

        this.ctx.fillStyle = '#00d9ff';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(`📍 ${currentLayer.name}`, 20, 27);
        
        this.ctx.font = '11px Arial';
        this.ctx.fillStyle = '#888';
        this.ctx.fillText(`元素: ${currentLayer.elements.length}`, 90, 27);
        
        this.ctx.restore();
    }

    // ==================== 核心几何遮挡算法 ====================

    getObstacles() {
        return this.currentElements.filter(el => {
            if (el.type === 'wall') return true;
            if (el.type === 'obstacle') return true;
            if (el.type === 'door') return true;
            if (el.type === 'stairs') return true;
            return false;
        });
    }

    raycastRect(originX, originY, dirX, dirY, rect) {
        const rotation = rect.rotation || 0;
        if (rotation !== 0) {
            return this.raycastRotatedRect(originX, originY, dirX, dirY, rect);
        }
        
        const edges = [
            { x1: rect.x, y1: rect.y, x2: rect.x + rect.width, y2: rect.y },
            { x1: rect.x + rect.width, y1: rect.y, x2: rect.x + rect.width, y2: rect.y + rect.height },
            { x1: rect.x, y1: rect.y + rect.height, x2: rect.x + rect.width, y2: rect.y + rect.height },
            { x1: rect.x, y1: rect.y, x2: rect.x, y2: rect.y + rect.height }
        ];

        let closestDist = Infinity;

        for (const edge of edges) {
            const dist = this.rayIntersectsLine(
                originX, originY, dirX, dirY,
                edge.x1, edge.y1, edge.x2, edge.y2
            );
            if (dist !== null && dist > 0 && dist < closestDist) {
                closestDist = dist;
            }
        }

        return closestDist === Infinity ? null : closestDist;
    }

    raycastRotatedRect(originX, originY, dirX, dirY, rect) {
        const rotation = rect.rotation || 0;
        if (rotation === 0) {
            return this.raycastRect(originX, originY, dirX, dirY, rect);
        }

        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        const rad = rotation * Math.PI / 180;
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);

        function rotatePoint(px, py) {
            const dx = px - centerX;
            const dy = py - centerY;
            return {
                x: centerX + dx * cosA - dy * sinA,
                y: centerY + dx * sinA + dy * cosA
            };
        }

        const corners = [
            rotatePoint(rect.x, rect.y),
            rotatePoint(rect.x + rect.width, rect.y),
            rotatePoint(rect.x + rect.width, rect.y + rect.height),
            rotatePoint(rect.x, rect.y + rect.height)
        ];

        const edges = [
            { x1: corners[0].x, y1: corners[0].y, x2: corners[1].x, y2: corners[1].y },
            { x1: corners[1].x, y1: corners[1].y, x2: corners[2].x, y2: corners[2].y },
            { x1: corners[2].x, y1: corners[2].y, x2: corners[3].x, y2: corners[3].y },
            { x1: corners[3].x, y1: corners[3].y, x2: corners[0].x, y2: corners[0].y }
        ];

        let closestDist = Infinity;
        for (const edge of edges) {
            const dist = this.rayIntersectsLine(originX, originY, dirX, dirY, edge.x1, edge.y1, edge.x2, edge.y2);
            if (dist !== null && dist > 0 && dist < closestDist) {
                closestDist = dist;
            }
        }
        return closestDist === Infinity ? null : closestDist;
    }

    rayIntersectsLine(px, py, dx, dy, x1, y1, x2, y2) {
        const v1x = px - x1;
        const v1y = py - y1;
        const v2x = x2 - x1;
        const v2y = y2 - y1;
        
        const cross = v2x * dy - v2y * dx;
        if (Math.abs(cross) < 0.0001) return null;
        
        const t1 = (v1x * v2y - v1y * v2x) / cross;
        const t2 = (v1x * dy - v1y * dx) / cross;
        
        if (t1 >= 0 && t2 >= 0 && t2 <= 1) {
            return t1;
        }
        return null;
    }

    raycastCircle(originX, originY, dirX, dirY, circleEl) {
        const cx = circleEl.x + circleEl.width / 2;
        const cy = circleEl.y + circleEl.height / 2;
        const rx = circleEl.width / 2;
        const ry = circleEl.height / 2;

        if (rx <= 0 || ry <= 0) return null;

        const ox = originX - cx;
        const oy = originY - cy;

        const a = (dirX * dirX) / (rx * rx) + (dirY * dirY) / (ry * ry);
        const b = 2 * (ox * dirX / (rx * rx) + oy * dirY / (ry * ry));
        const c = (ox * ox) / (rx * rx) + (oy * oy) / (ry * ry) - 1;

        const discriminant = b * b - 4 * a * c;
        if (discriminant < 0) return null;

        const sqrtD = Math.sqrt(discriminant);
        let t1 = (-b - sqrtD) / (2 * a);
        let t2 = (-b + sqrtD) / (2 * a);

        if (t1 > t2) [t1, t2] = [t2, t1];

        if (t2 < 0) return null;
        if (t1 < 0) t1 = 0;

        return t1 > 0.001 ? t1 : null;
    }

    // 射线与旋转门相交检测（支持4向铰链）
    raycastRotatedDoor(originX, originY, dirX, dirY, doorEl) {
        const doorAngle = doorEl.doorAngle || 0;
        if (doorAngle === 0) {
            return this.raycastRect(originX, originY, dirX, dirY, doorEl);
        }

        const { hingeX, hingeY } = this.getHingePos(doorEl);
        const rad = this.getDoorRotationRad(doorEl);
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);

        function rotatePoint(px, py) {
            const dx = px - hingeX;
            const dy = py - hingeY;
            return {
                x: hingeX + dx * cosA - dy * sinA,
                y: hingeY + dx * sinA + dy * cosA
            };
        }

        const corners = [
            rotatePoint(doorEl.x, doorEl.y),
            rotatePoint(doorEl.x + doorEl.width, doorEl.y),
            rotatePoint(doorEl.x + doorEl.width, doorEl.y + doorEl.height),
            rotatePoint(doorEl.x, doorEl.y + doorEl.height)
        ];

        const edges = [
            { x1: corners[0].x, y1: corners[0].y, x2: corners[1].x, y2: corners[1].y },
            { x1: corners[1].x, y1: corners[1].y, x2: corners[2].x, y2: corners[2].y },
            { x1: corners[2].x, y1: corners[2].y, x2: corners[3].x, y2: corners[3].y },
            { x1: corners[3].x, y1: corners[3].y, x2: corners[0].x, y2: corners[0].y }
        ];

        let closestDist = Infinity;
        for (const edge of edges) {
            const dist = this.rayIntersectsLine(originX, originY, dirX, dirY, edge.x1, edge.y1, edge.x2, edge.y2);
            if (dist !== null && dist > 0 && dist < closestDist) {
                closestDist = dist;
            }
        }
        return closestDist === Infinity ? null : closestDist;
    }

    // 获取门的铰链坐标（支持4向）
    getHingePos(doorEl) {
        const side = doorEl.hingeSide || 'left';
        switch (side) {
            case 'left':   return { hingeX: doorEl.x, hingeY: doorEl.y + doorEl.height / 2 };
            case 'right':  return { hingeX: doorEl.x + doorEl.width, hingeY: doorEl.y + doorEl.height / 2 };
            case 'top':    return { hingeX: doorEl.x + doorEl.width / 2, hingeY: doorEl.y };
            case 'bottom': return { hingeX: doorEl.x + doorEl.width / 2, hingeY: doorEl.y + doorEl.height };
            default:      return { hingeX: doorEl.x, hingeY: doorEl.y + doorEl.height / 2 };
        }
    }

    // 获取门旋转弧度（正=顺时针）
    getDoorRotationRad(doorEl) {
        const side = doorEl.hingeSide || 'left';
        const angle = doorEl.doorAngle || 0;
        switch (side) {
            case 'left':   return angle * Math.PI / 180;          // 左铰链→右摆（顺时针）
            case 'right':  return -angle * Math.PI / 180;         // 右铰链→左摆（逆时针）
            case 'top':    return angle * Math.PI / 180;          // 上铰链→下摆（顺时针）
            case 'bottom': return -angle * Math.PI / 180;         // 下铰链→上摆（逆时针）
            default:      return angle * Math.PI / 180;
        }
    }

    calculateOccludedFOVPolygon(person) {
        if (!person.fovAngle) return null;

        const cx = person.x;
        const cy = person.y;
        const maxRange = person.fovInfinite ? 2000 : person.fovRange;
        
        const baseAngle = ((person.rotation || 0) - 90) * Math.PI / 180;
        const halfFov = (person.fovAngle / 2) * Math.PI / 180;
        
        const startAngle = baseAngle - halfFov;
        const endAngle = baseAngle + halfFov;
        
        const numRays = 72;
        const angleStep = (endAngle - startAngle) / (numRays - 1);
        
        const obstacles = this.getObstacles();
        
        const points = [{ x: cx, y: cy }];
        
        for (let i = 0; i < numRays; i++) {
            const angle = startAngle + i * angleStep;
            const dirX = Math.cos(angle);
            const dirY = Math.sin(angle);
            
            let nearestDist = maxRange;
            
            for (const obs of obstacles) {
                let dist;
                if (obs.type === 'door') {
                    dist = this.raycastRotatedDoor(cx, cy, dirX, dirY, obs);
                } else if (obs.type === 'obstacle' && obs.shape === 'circle') {
                    dist = this.raycastCircle(cx, cy, dirX, dirY, obs);
                } else {
                    dist = this.raycastRect(cx, cy, dirX, dirY, obs);
                }
                if (dist !== null && dist < nearestDist) {
                    nearestDist = dist;
                }
            }
            
            points.push({
                x: cx + dirX * nearestDist,
                y: cy + dirY * nearestDist
            });
        }
        
        points.push({ x: cx, y: cy });
        
        return points;
    }

    drawPersonWithOccludedFOV(person) {
        if (!person.fovAngle) return;

        this.ctx.save();

        if (this.occlusionEnabled) {
            const polygon = this.calculateOccludedFOVPolygon(person);
            
            if (polygon && polygon.length > 2) {
                this.ctx.beginPath();
                this.ctx.moveTo(polygon[0].x, polygon[0].y);
                
                for (let i = 1; i < polygon.length; i++) {
                    this.ctx.lineTo(polygon[i].x, polygon[i].y);
                }
                
                this.ctx.closePath();
                
                const maxDist = person.fovInfinite ? 300 : person.fovRange;
                const gradient = this.ctx.createRadialGradient(
                    person.x, person.y, 0,
                    person.x, person.y, maxDist
                );
                gradient.addColorStop(0, person.color + '60');
                gradient.addColorStop(0.7, person.color + '30');
                gradient.addColorStop(1, person.color + '08');
                
                this.ctx.fillStyle = gradient;
                this.ctx.fill();
            }
        } else {
            const baseAngle = ((person.rotation || 0) - 90) * Math.PI / 180;
            const halfFov = (person.fovAngle / 2) * Math.PI / 180;
            
            const startAngle = baseAngle - halfFov;
            const endAngle = baseAngle + halfFov;
            
            this.ctx.beginPath();
            this.ctx.moveTo(person.x, person.y);
            
            const maxDist = person.fovInfinite ? 2000 : person.fovRange;
            this.ctx.arc(person.x, person.y, maxDist, startAngle, endAngle);
            
            this.ctx.closePath();
            
            const maxRenderDist = person.fovInfinite ? 300 : person.fovRange;
            const gradient = this.ctx.createRadialGradient(
                person.x, person.y, 0,
                person.x, person.y, maxRenderDist
            );
            gradient.addColorStop(0, person.color + '50');
            gradient.addColorStop(0.7, person.color + '25');
            gradient.addColorStop(1, person.color + '08');
            
            this.ctx.fillStyle = gradient;
            this.ctx.fill();
            
            this.ctx.strokeStyle = person.color;
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([4, 4]);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }

        this.ctx.restore();
    }

    // ==================== 元素绘制 ====================

    drawElement(el) {
        this.ctx.save();

        // 门不使用通用旋转（门有自己的铰链旋转）
        if (el.rotation && el.type !== 'door') {
            const centerX = el.radius ? el.x : el.x + el.width / 2;
            const centerY = el.radius ? el.y : el.y + el.height / 2;
            
            this.ctx.translate(centerX, centerY);
            this.ctx.rotate((el.rotation * Math.PI) / 180);
            this.ctx.translate(-centerX, -centerY);
        }

        switch (el.type) {
            case 'wall': this.drawWall(el); break;
            case 'door': this.drawDoor(el); break;
            case 'window': this.drawWindow(el); break;
            case 'stairs': this.drawStairs(el); break;
            case 'furniture':
            case 'obstacle': this.drawObstacle(el); break;
        }

        if (el.label) {
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 11px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'top';
            
            let labelX = el.radius ? el.x : el.x + el.width / 2;
            let labelY = el.radius ? el.y + el.radius + 5 : el.y + el.height + 5;
            this.ctx.fillText(el.label, labelX, labelY);
        }

        this.ctx.restore();
    }

    drawWall(el) {
        this.ctx.fillStyle = el.color;
        this.ctx.fillRect(el.x, el.y, el.width, el.height);
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(el.x, el.y, el.width, el.height);
    }

    drawDoor(el) {
        const doorAngle = el.doorAngle || 0;
        const isOpen = doorAngle > 0;
        const side = el.hingeSide || 'left';
        const { hingeX, hingeY } = this.getHingePos(el);
        const isHorizontal = side === 'left' || side === 'right';
        const doorLen = isHorizontal ? el.width : el.height;
        const doorThick = isHorizontal ? el.height : el.width;

        this.ctx.save();

        // 1. 门框（关闭位置）
        this.ctx.strokeStyle = 'rgba(128, 128, 128, 0.7)';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(el.x, el.y, el.width, el.height);

        // 3. 门板
        if (isOpen) {
            const rad = this.getDoorRotationRad(el);
            const cosR = Math.cos(rad);
            const sinR = Math.sin(rad);

            // 计算门板4个角点
            const rotPoint = (lx, ly) => ({
                x: hingeX + lx * cosR - ly * sinR,
                y: hingeY + lx * sinR + ly * cosR
            });

            let corners;
            if (isHorizontal) {
                corners = [
                    rotPoint(0, -doorThick / 2),
                    rotPoint(doorLen, -doorThick / 2),
                    rotPoint(doorLen, doorThick / 2),
                    rotPoint(0, doorThick / 2)
                ];
            } else {
                corners = [
                    rotPoint(-doorThick / 2, 0),
                    rotPoint(-doorThick / 2, doorLen),
                    rotPoint(doorThick / 2, doorLen),
                    rotPoint(doorThick / 2, 0)
                ];
            }

            // 绘制门板主体
            this.ctx.beginPath();
            this.ctx.moveTo(corners[0].x, corners[0].y);
            for (let i = 1; i < corners.length; i++) {
                this.ctx.lineTo(corners[i].x, corners[i].y);
            }
            this.ctx.closePath();
            
            // 门板渐变效果（防御性检查）
            let fillStyle = '#e0e0e0';
            if (isFinite(corners[0].x) && isFinite(corners[0].y) && 
                isFinite(corners[2].x) && isFinite(corners[2].y)) {
                const grad = this.ctx.createLinearGradient(
                    corners[0].x, corners[0].y,
                    corners[2].x, corners[2].y
                );
                grad.addColorStop(0, '#f0f0f0');
                grad.addColorStop(0.5, '#e0e0e0');
                grad.addColorStop(1, '#d0d0d0');
                fillStyle = grad;
            }
            this.ctx.fillStyle = fillStyle;
            this.ctx.fill();
            
            // 门板边框
            this.ctx.strokeStyle = '#888';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // 门把手（金属质感）
            const handleLocal = isHorizontal
                ? { x: doorLen - 8, y: 0 }
                : { x: 0, y: doorLen - 8 };
            const handleWorld = rotPoint(handleLocal.x, handleLocal.y);
            
            this.ctx.fillStyle = '#b8b8b8';
            this.ctx.beginPath();
            this.ctx.arc(handleWorld.x, handleWorld.y, 4, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.strokeStyle = '#666';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();

            // 角度标注
            const labelLocal = isHorizontal
                ? { x: doorLen / 2, y: -doorThick / 2 - 12 }
                : { x: 0, y: side === 'top' ? -16 : 18 };
            const labelWorld = rotPoint(labelLocal.x, labelLocal.y);
            
            this.ctx.fillStyle = '#333';
            this.ctx.font = 'bold 11px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(`${doorAngle}°`, labelWorld.x, labelWorld.y);
        } else {
            // 关闭状态：绘制实心门板
            const grad = this.ctx.createLinearGradient(
                el.x, el.y,
                el.x + el.width, el.y + el.height
            );
            grad.addColorStop(0, '#f5f5f5');
            grad.addColorStop(0.5, '#e5e5e5');
            grad.addColorStop(1, '#d5d5d5');
            this.ctx.fillStyle = grad;
            this.ctx.fillRect(el.x, el.y, el.width, el.height);
            
            this.ctx.strokeStyle = '#888';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(el.x, el.y, el.width, el.height);

            // 门把手（中心位置）
            this.ctx.fillStyle = '#b8b8b8';
            this.ctx.beginPath();
            this.ctx.arc(el.x + el.width / 2, el.y + el.height / 2, 4, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.strokeStyle = '#666';
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        }

        // 4. 铰链（金属质感）
        this.ctx.fillStyle = '#c0c0c0';
        this.ctx.beginPath();
        this.ctx.arc(hingeX, hingeY, 6, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.strokeStyle = '#888';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // 铰链螺丝
        this.ctx.fillStyle = '#666';
        this.ctx.beginPath();
        this.ctx.arc(hingeX, hingeY, 2, 0, Math.PI * 2);
        this.ctx.fill();

        // 5. 开合方向指示
        let arrowAngle;
        if (side === 'left') arrowAngle = -Math.PI / 4;
        else if (side === 'right') arrowAngle = Math.PI * 3 / 4;
        else if (side === 'top') arrowAngle = Math.PI / 4;
        else arrowAngle = -Math.PI * 3 / 4;
        
        const arrowDist = 20;
        const ax = hingeX + Math.cos(arrowAngle) * arrowDist;
        const ay = hingeY + Math.sin(arrowAngle) * arrowDist;
        
        this.ctx.fillStyle = 'rgba(100, 100, 100, 0.7)';
        this.ctx.beginPath();
        this.ctx.moveTo(ax, ay - 5);
        this.ctx.lineTo(ax + 5, ay + 3);
        this.ctx.lineTo(ax - 5, ay + 3);
        this.ctx.closePath();
        this.ctx.fill();

        // 6. 状态指示器
        this.ctx.fillStyle = isOpen ? '#4CAF50' : '#9E9E9E';
        this.ctx.font = 'bold 10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        const stateText = isOpen ? '开启' : '关闭';
        const stateX = el.x + el.width / 2;
        const stateY = side === 'top' ? el.y - 12 : 
                      side === 'bottom' ? el.y + el.height + 12 :
                      el.y + el.height + 12;
        
        this.ctx.fillText(stateText, stateX, stateY);

        this.ctx.restore();
    }

    drawWindow(el) {
        this.ctx.fillStyle = 'rgba(135, 206, 235, 0.4)';
        this.ctx.fillRect(el.x, el.y, el.width, el.height);
        this.ctx.strokeStyle = el.color;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(el.x, el.y, el.width, el.height);
        this.ctx.beginPath();
        this.ctx.moveTo(el.x + el.width / 2, el.y);
        this.ctx.lineTo(el.x + el.width / 2, el.y + el.height);
        this.ctx.stroke();
    }

    drawStairs(el) {
        this.ctx.fillStyle = el.color + '40';
        this.ctx.fillRect(el.x, el.y, el.width, el.height);
        
        this.ctx.strokeStyle = el.color;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(el.x, el.y, el.width, el.height);
        
        const steps = 6;
        const stepHeight = el.height / steps;
        
        for (let i = 1; i < steps; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(el.x, el.y + i * stepHeight);
            this.ctx.lineTo(el.x + el.width, el.y + i * stepHeight);
            this.ctx.stroke();
        }
        
        this.ctx.fillStyle = el.color;
        this.ctx.beginPath();
        const arrowY = el.y + el.height / 2;
        this.ctx.moveTo(el.x + el.width / 2, arrowY - 8);
        this.ctx.lineTo(el.x + el.width / 2 - 6, arrowY);
        this.ctx.lineTo(el.x + el.width / 2 + 6, arrowY);
        this.ctx.closePath();
        this.ctx.fill();
        
        if (el.targetLayerId) {
            const targetName = this.getLayerNameById(el.targetLayerId);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 10px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`→ ${targetName}`, el.x + el.width / 2, el.y + el.height + 12);
        }
    }

    drawObstacle(el) {
        const shape = el.shape || 'rectangle';
        this.ctx.fillStyle = el.color;
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        this.ctx.lineWidth = 1;

        switch (shape) {
            case 'rectangle':
                this.ctx.fillRect(el.x, el.y, el.width, el.height);
                this.ctx.strokeRect(el.x, el.y, el.width, el.height);
                break;
                
            case 'circle':
                const radiusX = el.width / 2;
                const radiusY = el.height / 2;
                this.ctx.beginPath();
                this.ctx.ellipse(el.x + radiusX, el.y + radiusY, radiusX, radiusY, 0, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.stroke();
                break;
        }

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        this.ctx.lineWidth = 1;
        if (shape === 'rectangle' || shape === 'circle') {
            this.ctx.beginPath();
            this.ctx.moveTo(el.x + 5, el.y + 5);
            this.ctx.lineTo(el.x + el.width - 5, el.y + el.height - 5);
            this.ctx.stroke();
        }
    }

    drawPerson(el) {
        const radius = el.radius || 18;

        this.ctx.beginPath();
        this.ctx.arc(el.x, el.y, radius, 0, Math.PI * 2);
        
        const personGradient = this.ctx.createRadialGradient(
            el.x - radius/3, el.y - radius/3, 0,
            el.x, el.y, radius
        );
        personGradient.addColorStop(0, this.lightenColor(el.color, 30));
        personGradient.addColorStop(1, el.color);
        
        this.ctx.fillStyle = personGradient;
        this.ctx.fill();
        
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // 方向箭头
        this.ctx.save();
        this.ctx.translate(el.x, el.y);
        const angle = ((el.rotation || 0) - 90) * Math.PI / 180;
        this.ctx.rotate(angle);
        
        this.ctx.fillStyle = '#fff';
        this.ctx.beginPath();
        this.ctx.moveTo(0, -radius + 3);
        this.ctx.lineTo(-4, -radius + 9);
        this.ctx.lineTo(4, -radius + 9);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.restore();

        // 名称标签（如果有）
        if (el.personName) {
            this.ctx.fillStyle = 'rgba(255,255,255,0.85)';
            this.ctx.font = 'bold 9px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'top';
            this.ctx.fillText(el.personName, el.x, el.y + radius + 4);
        }

        this.ctx.fillStyle = '#fff';
        this.ctx.font = `bold ${radius}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        const icons = { operator: '👤', hostile: '💀', hostage: '🙋' };
        this.ctx.fillText(icons[el.type] || '', el.x, el.y + 1);
    }

    // ==================== 枪线绘制 ====================

    drawGunline(gl) {
        this.ctx.save();
        this.ctx.strokeStyle = gl.color || '#e74c3c';
        this.ctx.lineWidth = 2.5;
        this.ctx.setLineDash([]);
        this.ctx.globalAlpha = 0.85;

        this.ctx.beginPath();
        this.ctx.moveTo(gl.fromX, gl.fromY);
        this.ctx.lineTo(gl.toX, gl.toY);
        this.ctx.stroke();

        // 起点（人员处）圆点
        this.ctx.fillStyle = gl.color || '#e74c3c';
        this.ctx.beginPath();
        this.ctx.arc(gl.fromX, gl.fromY, 4, 0, Math.PI * 2);
        this.ctx.fill();

        // 终点箭头
        const angle = Math.atan2(gl.toY - gl.fromY, gl.toX - gl.fromX);
        const arrowLen = 10;
        this.ctx.beginPath();
        this.ctx.moveTo(gl.toX, gl.toY);
        this.ctx.lineTo(gl.toX - arrowLen * Math.cos(angle - Math.PI / 6), gl.toY - arrowLen * Math.sin(angle - Math.PI / 6));
        this.ctx.moveTo(gl.toX, gl.toY);
        this.ctx.lineTo(gl.toX - arrowLen * Math.cos(angle + Math.PI / 6), gl.toY - arrowLen * Math.sin(angle + Math.PI / 6));
        this.ctx.stroke();

        this.ctx.restore();
    }

    // 绘制画板元素
    drawDrawElement(el) {
        this.ctx.save();
        this.ctx.strokeStyle = el.color;
        this.ctx.lineWidth = el.lineWidth;
        
        if (el.type === 'draw-path') {
            // 自由绘制路径
            this.ctx.beginPath();
            this.ctx.moveTo(el.path[0].x, el.path[0].y);
            for (let i = 1; i < el.path.length; i++) {
                this.ctx.lineTo(el.path[i].x, el.path[i].y);
            }
            this.ctx.stroke();
        } else if (el.type === 'draw-rect') {
            // 矩形
            this.ctx.strokeRect(el.x, el.y, el.width, el.height);
        } else if (el.type === 'draw-circle') {
            // 圆形
            this.ctx.beginPath();
            this.ctx.arc(el.x, el.y, el.radius, 0, Math.PI * 2);
            this.ctx.stroke();
        } else if (el.type === 'draw-line') {
            // 直线
            this.ctx.beginPath();
            this.ctx.moveTo(el.x1, el.y1);
            this.ctx.lineTo(el.x2, el.y2);
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }

    drawGunlinePreview(person, endPos) {
        this.ctx.save();
        this.ctx.strokeStyle = person.color;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([8, 4]);
        this.ctx.globalAlpha = 0.7;

        this.ctx.beginPath();
        this.ctx.moveTo(person.x, person.y);
        this.ctx.lineTo(endPos.x, endPos.y);
        this.ctx.stroke();

        this.ctx.restore();
    }

    // 画板工具预览
    drawDrawPreview(x, y) {
        this.ctx.save();
        this.ctx.strokeStyle = this.drawingColor;
        this.ctx.lineWidth = this.drawingWidth;
        
        if (this.currentTool === 'draw') {
            // 自由绘制预览（实时显示当前路径）
            if (this.drawingPath.length > 1) {
                this.ctx.beginPath();
                this.ctx.moveTo(this.drawingPath[0].x, this.drawingPath[0].y);
                for (let i = 1; i < this.drawingPath.length; i++) {
                    this.ctx.lineTo(this.drawingPath[i].x, this.drawingPath[i].y);
                }
                this.ctx.stroke();
            }
        } else if (this.currentTool === 'draw-rect') {
            const dx = Math.min(this.drawStartX, x);
            const dy = Math.min(this.drawStartY, y);
            const dw = Math.abs(x - this.drawStartX);
            const dh = Math.abs(y - this.drawStartY);
            this.ctx.strokeRect(dx, dy, dw, dh);
        } else if (this.currentTool === 'draw-circle') {
            const radius = Math.sqrt(
                Math.pow(x - this.drawStartX, 2) + Math.pow(y - this.drawStartY, 2)
            );
            this.ctx.beginPath();
            this.ctx.arc(this.drawStartX, this.drawStartY, radius, 0, Math.PI * 2);
            this.ctx.stroke();
        } else if (this.currentTool === 'draw-line') {
            this.ctx.beginPath();
            this.ctx.moveTo(this.drawStartX, this.drawStartY);
            this.ctx.lineTo(x, y);
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }

    // 区域删除预览
    drawErasePreview(x, y) {
        this.ctx.save();
        this.ctx.strokeStyle = '#e74c3c';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 3]);
        this.ctx.globalAlpha = 0.7;
        
        const dx = Math.min(this.eraseStartX, x);
        const dy = Math.min(this.eraseStartY, y);
        const dw = Math.abs(x - this.eraseStartX);
        const dh = Math.abs(y - this.eraseStartY);
        
        this.ctx.strokeRect(dx, dy, dw, dh);
        
        // 填充半透明红色
        this.ctx.fillStyle = 'rgba(231, 76, 60, 0.2)';
        this.ctx.fillRect(dx, dy, dw, dh);
        
        this.ctx.setLineDash([]);
        this.ctx.restore();
    }

    // 碰撞检测辅助方法
    rectIntersects(rect1, rect2) {
        return !(
            rect1.x > rect2.x + rect2.width ||
            rect1.x + rect1.width < rect2.x ||
            rect1.y > rect2.y + rect2.height ||
            rect1.y + rect1.height < rect2.y
        );
    }

    circleIntersectsRect(circle, rect) {
        const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
        const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
        const distX = circle.x - closestX;
        const distY = circle.y - closestY;
        return distX * distX + distY * distY <= circle.radius * circle.radius;
    }

    lineIntersectsRect(line, rect) {
        const left = { x: rect.x, y: rect.y, x2: rect.x, y2: rect.y + rect.height };
        const right = { x: rect.x + rect.width, y: rect.y, x2: rect.x + rect.width, y2: rect.y + rect.height };
        const top = { x: rect.x, y: rect.y, x2: rect.x + rect.width, y2: rect.y };
        const bottom = { x: rect.x, y: rect.y + rect.height, x2: rect.x + rect.width, y2: rect.y + rect.height };
        
        return this.lineIntersectsLine(line, left) ||
               this.lineIntersectsLine(line, right) ||
               this.lineIntersectsLine(line, top) ||
               this.lineIntersectsLine(line, bottom) ||
               (line.x1 >= rect.x && line.x1 <= rect.x + rect.width &&
                line.y1 >= rect.y && line.y1 <= rect.y + rect.height);
    }

    lineIntersectsLine(line1, line2) {
        const denominator = (line2.y2 - line2.y1) * (line1.x2 - line1.x1) - (line2.x2 - line2.x1) * (line1.y2 - line1.y1);
        if (denominator === 0) return false;
        
        const ua = ((line2.x2 - line2.x1) * (line1.y1 - line2.y1) - (line2.y2 - line2.y1) * (line1.x1 - line2.x1)) / denominator;
        const ub = ((line1.x2 - line1.x1) * (line1.y1 - line2.y1) - (line1.y2 - line1.y1) * (line1.x1 - line2.x1)) / denominator;
        
        return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
    }

    pathIntersectsRect(path, rect) {
        for (let i = 0; i < path.path.length - 1; i++) {
            const line = {
                x1: path.path[i].x,
                y1: path.path[i].y,
                x2: path.path[i + 1].x,
                y2: path.path[i + 1].y
            };
            if (this.lineIntersectsRect(line, rect)) {
                return true;
            }
        }
        return false;
    }

    // 清空当前图层的所有画板元素
    clearDrawElements() {
        const layer = this.layers.find(l => l.id === this.currentLayerId);
        if (layer) {
            const elementsToKeep = layer.elements.filter(el => !el.type.startsWith('draw-'));
            if (elementsToKeep.length !== layer.elements.length) {
                layer.elements = elementsToKeep;
                this.saveHistory();
                this.render();
            }
        }
    }

    lightenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x000FFFF) + amt;
        return '#' + (
            0x1000000 +
            (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
            (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
            (B < 255 ? (B < 1 ? 0 : B) : 255)
        ).toString(16).slice(1);
    }

    drawSelectionBox(el) {
        this.ctx.save();
        this.ctx.strokeStyle = '#e94560';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);

        if (el.type === 'gunline') {
            // 枪线选中：高亮整条线
            this.ctx.strokeStyle = '#e94560';
            this.ctx.lineWidth = 4;
            this.ctx.setLineDash([]);
            this.ctx.beginPath();
            this.ctx.moveTo(el.fromX, el.fromY);
            this.ctx.lineTo(el.toX, el.toY);
            this.ctx.stroke();
        } else if (el.radius) {
            this.ctx.beginPath();
            this.ctx.arc(el.x, el.y, el.radius + 5, 0, Math.PI * 2);
            this.ctx.stroke();
            
            const corners = [
                [el.x, el.y - el.radius - 5],
                [el.x, el.y + el.radius + 5],
                [el.x - el.radius - 5, el.y],
                [el.x + el.radius + 5, el.y]
            ];
            
            corners.forEach(([cx, cy]) => {
                this.ctx.fillStyle = '#e94560';
                this.ctx.fillRect(cx - 4, cy - 4, 8, 8);
            });
        } else {
            this.ctx.strokeRect(el.x - 5, el.y - 5, el.width + 10, el.height + 10);
            
            const corners = [
                [el.x - 5, el.y - 5],
                [el.x + el.width + 5, el.y - 5],
                [el.x - 5, el.y + el.height + 5],
                [el.x + el.width + 5, el.y + el.height + 5]
            ];
            
            corners.forEach(([cx, cy]) => {
                this.ctx.fillStyle = '#e94560';
                this.ctx.fillRect(cx - 4, cy - 4, 8, 8);
            });
        }

        this.ctx.restore();
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.tacticalBoard = new CQBTacticalBoard();
});

