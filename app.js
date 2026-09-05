(() => {
    const REQUIRED_COLUMNS = ['거래처명', '주소'];
    const DEFAULT_CLUSTER_DISTANCE_M = 1000;
    const MARKER_RADIUS = 6;
    const LABEL_GAP = 10;
    const LABEL_PADDING = 6;
    const MAX_VISIBLE_RESULTS = 100;
    const SAMPLE_CLIENTS = Object.freeze([
        { name: '서울시청', address: '서울특별시 중구 세종대로 110' },
        { name: '광화문', address: '서울특별시 종로구 세종대로 175' },
        { name: '종로1가', address: '서울특별시 종로구 종로 1' },
        { name: '을지로', address: '서울특별시 중구 을지로 30' },
        { name: '명동', address: '서울특별시 중구 퇴계로 100' },
        { name: '서울역', address: '서울특별시 용산구 한강대로 405' },
    ]);

    const state = {
        map: null,
        geocoder: null,
        originPosition: null,
        originMarker: null,
        clientMarkers: [],
        placedLabels: [],
        repositionTimer: null,
        allClients: [],
        selectedClients: [],
        geocodeCache: new Map(),
    };

    const elements = {
        apiKey: document.getElementById('apiKeyInput'),
        originAddress: document.getElementById('originAddressInput'),
        clusterDistance: document.getElementById('clusterDistanceInput'),
        initMap: document.getElementById('initMapButton'),
        excelFile: document.getElementById('excelFile'),
        loadSample: document.getElementById('loadSampleButton'),
        search: document.getElementById('searchInput'),
        selectAll: document.getElementById('selectAllButton'),
        searchList: document.getElementById('searchList'),
        selectedList: document.getElementById('selectedList'),
        clearSelected: document.getElementById('clearSelectedButton'),
        print: document.getElementById('printButton'),
        status: document.getElementById('status'),
        map: document.getElementById('map'),
        lineCanvas: document.getElementById('line-canvas'),
        labelCanvas: document.getElementById('label-canvas'),
        measureBox: document.getElementById('measure-box'),
    };

    function setStatus(message, kind = 'info') {
        elements.status.textContent = message;
        elements.status.dataset.kind = kind;
    }

    function loadKakaoSdk(appKey) {
        if (window.kakao?.maps) {
            return new Promise(resolve => window.kakao.maps.load(resolve));
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&libraries=services&autoload=false`;
            script.async = true;
            script.onload = () => window.kakao.maps.load(resolve);
            script.onerror = () => reject(new Error('Kakao Maps SDK를 불러오지 못했습니다. 키와 허용 도메인을 확인하세요.'));
            document.head.appendChild(script);
        });
    }

    function geocodeAddress(address) {
        if (state.geocodeCache.has(address)) {
            return Promise.resolve(state.geocodeCache.get(address));
        }

        return new Promise(resolve => {
            state.geocoder.addressSearch(address, (result, status) => {
                if (status !== kakao.maps.services.Status.OK || result.length === 0) {
                    state.geocodeCache.set(address, null);
                    resolve(null);
                    return;
                }
                const point = {
                    lat: Number(result[0].y),
                    lng: Number(result[0].x),
                };
                state.geocodeCache.set(address, point);
                resolve(point);
            });
        });
    }

    function getClusterDistance() {
        const distance = GeoUtils.normalizeClusterDistance(
            elements.clusterDistance.value,
            DEFAULT_CLUSTER_DISTANCE_M,
        );
        elements.clusterDistance.value = String(distance);
        return distance;
    }

    async function initializeMap() {
        const appKey = elements.apiKey.value.trim();
        if (!appKey) {
            setStatus('Kakao JavaScript 키를 입력하세요.', 'error');
            elements.apiKey.focus();
            return;
        }

        elements.initMap.disabled = true;
        setStatus('지도를 초기화하고 있습니다…', 'working');

        try {
            await loadKakaoSdk(appKey);
            state.map = new kakao.maps.Map(elements.map, {
                center: new kakao.maps.LatLng(37.5665, 126.9780),
                level: 8,
            });
            state.geocoder = new kakao.maps.services.Geocoder();
            kakao.maps.event.addListener(state.map, 'idle', scheduleReposition);

            const originAddress = elements.originAddress.value.trim();
            if (originAddress) {
                await setOriginAddress(originAddress);
            } else {
                setStatus('지도 활성화 완료. 기준 주소는 선택 사항입니다.', 'success');
            }

            if (state.selectedClients.length > 0) {
                await updateMap();
            }
        } catch (error) {
            console.error(error);
            setStatus(error.message || '지도 초기화 중 오류가 발생했습니다.', 'error');
        } finally {
            elements.initMap.disabled = false;
        }
    }

    async function setOriginAddress(address) {
        const point = await geocodeAddress(address);
        if (!point) {
            state.originPosition = null;
            if (state.originMarker) state.originMarker.setMap(null);
            state.originMarker = null;
            setStatus(`기준 주소를 찾지 못했습니다: ${address}`, 'error');
            return;
        }

        state.originPosition = new kakao.maps.LatLng(point.lat, point.lng);
        if (state.originMarker) state.originMarker.setMap(null);
        state.originMarker = new kakao.maps.Marker({
            map: state.map,
            position: state.originPosition,
            image: kakaoMarkerImage(makeMarkerImage('#1971c2', true)),
            zIndex: 10,
        });
        state.map.setCenter(state.originPosition);
        setStatus('지도와 기준 위치를 활성화했습니다.', 'success');
    }

    function normalizeClient(row) {
        return {
            name: String(row['거래처명'] ?? '').trim(),
            address: String(row['주소'] ?? '').trim(),
        };
    }

    function validateRows(rows) {
        if (rows.length === 0) throw new Error('Excel 첫 번째 시트에 데이터가 없습니다.');
        const firstRow = rows[0];
        const missing = REQUIRED_COLUMNS.filter(column => !(column in firstRow));
        if (missing.length > 0) {
            throw new Error(`필수 컬럼이 없습니다: ${missing.join(', ')}`);
        }
    }

    function deduplicateClients(rows) {
        const seen = new Set();
        const result = [];
        for (const row of rows) {
            const client = normalizeClient(row);
            if (!client.name || !client.address) continue;
            const key = `${client.name}\u0000${client.address}`;
            if (seen.has(key)) continue;
            seen.add(key);
            result.push(client);
        }
        return result;
    }

    function readExcel(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
            reader.onload = event => {
                try {
                    const workbook = XLSX.read(event.target.result, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
                    validateRows(rows);
                    resolve(deduplicateClients(rows));
                } catch (error) {
                    reject(error);
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }

    function setClientData(clients, { autoSelect = false, source = '데이터' } = {}) {
        state.allClients = clients;
        state.selectedClients = autoSelect ? [...clients] : [];
        elements.search.value = '';
        renderSearchResults('');
        renderSelectedList();
        clearClientMarkers();
        clearCanvas();
        setStatus(`${source}에서 거래처 ${clients.length}건을 불러왔습니다${autoSelect ? ' · 전체 선택됨' : ''}.`, 'success');
    }

    async function handleExcelFile(event) {
        const [file] = event.target.files;
        if (!file) return;
        setStatus('Excel 데이터를 읽고 있습니다…', 'working');

        try {
            const clients = await readExcel(file);
            setClientData(clients, { source: file.name });
        } catch (error) {
            console.error(error);
            state.allClients = [];
            state.selectedClients = [];
            renderSearchResults('');
            renderSelectedList();
            setStatus(error.message || 'Excel 처리 중 오류가 발생했습니다.', 'error');
        }
    }

    async function loadSampleData() {
        setClientData(SAMPLE_CLIENTS.map(client => ({ ...client })), {
            autoSelect: true,
            source: '샘플 데이터',
        });
        if (state.map) await updateMap();
    }

    function createListRow(client, buttonText, buttonClass, onClick) {
        const row = document.createElement('div');
        row.className = 'list-row';

        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = buttonText;
        if (buttonClass) button.className = buttonClass;
        button.addEventListener('click', onClick);

        const meta = document.createElement('div');
        meta.className = 'meta';
        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = client.name;
        const address = document.createElement('div');
        address.className = 'address';
        address.textContent = client.address;

        meta.append(name, address);
        row.append(button, meta);
        return row;
    }

    function renderEmpty(container, message) {
        const empty = document.createElement('div');
        empty.className = 'list-empty';
        empty.textContent = message;
        container.replaceChildren(empty);
    }

    function getVisibleClients(query = elements.search.value) {
        const normalized = query.trim().toLocaleLowerCase('ko-KR');
        const matches = normalized
            ? state.allClients.filter(client => client.name.toLocaleLowerCase('ko-KR').includes(normalized))
            : state.allClients;
        return matches.slice(0, MAX_VISIBLE_RESULTS);
    }

    function renderSearchResults(query) {
        if (state.allClients.length === 0) {
            renderEmpty(elements.searchList, 'Excel 또는 샘플 데이터를 먼저 불러오세요.');
            return;
        }

        const matches = getVisibleClients(query);
        if (matches.length === 0) {
            renderEmpty(elements.searchList, '검색 결과가 없습니다.');
            return;
        }

        const fragment = document.createDocumentFragment();
        for (const client of matches) {
            fragment.appendChild(createListRow(client, '+', '', () => addClient(client)));
        }
        elements.searchList.replaceChildren(fragment);
    }

    function clientKey(client) {
        return `${client.name}\u0000${client.address}`;
    }

    async function addClient(client) {
        if (state.selectedClients.some(item => clientKey(item) === clientKey(client))) return;
        state.selectedClients.push(client);
        renderSelectedList();
        if (state.map) await updateMap();
    }

    async function selectVisibleClients() {
        const existing = new Set(state.selectedClients.map(clientKey));
        for (const client of getVisibleClients()) {
            const key = clientKey(client);
            if (!existing.has(key)) {
                state.selectedClients.push(client);
                existing.add(key);
            }
        }
        renderSelectedList();
        if (state.map) await updateMap();
        else setStatus(`현재 목록에서 ${state.selectedClients.length}건을 선택했습니다.`, 'success');
    }

    async function removeClient(client) {
        const key = clientKey(client);
        state.selectedClients = state.selectedClients.filter(item => clientKey(item) !== key);
        renderSelectedList();
        if (state.map) await updateMap();
    }

    async function clearSelectedClients() {
        state.selectedClients = [];
        renderSelectedList();
        clearClientMarkers();
        clearCanvas();
        setStatus('지도 표시 목록을 비웠습니다.');
    }

    function renderSelectedList() {
        if (state.selectedClients.length === 0) {
            renderEmpty(elements.selectedList, '표시할 거래처가 없습니다.');
            return;
        }

        const fragment = document.createDocumentFragment();
        for (const client of state.selectedClients) {
            fragment.appendChild(createListRow(client, '×', 'danger', () => removeClient(client)));
        }
        elements.selectedList.replaceChildren(fragment);
    }

    function makeMarkerImage(color, withDot) {
        const size = (MARKER_RADIUS + 2) * 2;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const context = canvas.getContext('2d');

        context.beginPath();
        context.arc(size / 2, size / 2, MARKER_RADIUS + 1, 0, Math.PI * 2);
        context.fillStyle = '#fff';
        context.fill();

        context.beginPath();
        context.arc(size / 2, size / 2, MARKER_RADIUS, 0, Math.PI * 2);
        context.fillStyle = color;
        context.fill();

        if (withDot) {
            context.beginPath();
            context.arc(size / 2, size / 2, 2.5, 0, Math.PI * 2);
            context.fillStyle = '#fff';
            context.fill();
        }

        return canvas.toDataURL();
    }

    function kakaoMarkerImage(dataUrl) {
        const size = (MARKER_RADIUS + 2) * 2;
        return new kakao.maps.MarkerImage(
            dataUrl,
            new kakao.maps.Size(size, size),
            { offset: new kakao.maps.Point(size / 2, size / 2) },
        );
    }

    function clearClientMarkers() {
        state.clientMarkers.forEach(marker => marker.setMap(null));
        state.clientMarkers = [];
        state.placedLabels = [];
    }

    async function updateMap() {
        if (!state.map || !state.geocoder) return;
        clearClientMarkers();
        clearCanvas();
        if (state.selectedClients.length === 0) return;

        setStatus(`선택한 거래처 ${state.selectedClients.length}건의 주소를 확인하고 있습니다…`, 'working');
        const geocoded = await Promise.all(state.selectedClients.map(async client => {
            const point = await geocodeAddress(client.address);
            return point ? { ...point, name: client.name, address: client.address } : { failed: true, ...client };
        }));

        const points = geocoded.filter(item => !item.failed);
        const failed = geocoded.filter(item => item.failed);
        if (points.length === 0) {
            setStatus('선택한 거래처의 주소를 지오코딩하지 못했습니다.', 'error');
            return;
        }

        const clusterDistance = getClusterDistance();
        buildMarkers(points, clusterDistance);
        const suffix = failed.length > 0 ? ` · 주소 확인 실패 ${failed.length}건` : '';
        setStatus(`지도에 ${points.length}건을 표시했습니다 · 클러스터 ${clusterDistance.toLocaleString()}m${suffix}.`, failed.length ? 'info' : 'success');
    }

    function measureLabel(names) {
        const label = document.createElement('div');
        if (names.length === 1) {
            label.className = names[0].length > 10 ? 'lbl wrap' : 'lbl';
            label.textContent = names[0];
        } else {
            label.className = 'lbl cluster';
            names.forEach((name, index) => {
                const row = document.createElement('div');
                row.textContent = `${index === 0 ? '●' : '·'} ${name}`;
                label.appendChild(row);
            });
        }
        label.style.position = 'static';
        elements.measureBox.appendChild(label);
        const dimensions = { width: label.offsetWidth, height: label.offsetHeight };
        label.remove();
        return dimensions;
    }

    function buildMarkers(points, clusterDistance) {
        const markerImage = kakaoMarkerImage(makeMarkerImage('#e63946', false));
        const bounds = new kakao.maps.LatLngBounds();
        if (state.originPosition) bounds.extend(state.originPosition);

        const clusters = GeoUtils.clusterByDistance(points, clusterDistance);
        for (const cluster of clusters) {
            const position = new kakao.maps.LatLng(cluster.lat, cluster.lng);
            const marker = new kakao.maps.Marker({ map: state.map, position, image: markerImage });
            const labelSize = measureLabel(cluster.names);
            state.clientMarkers.push(marker);
            state.placedLabels.push({
                marker,
                position,
                names: cluster.names,
                width: labelSize.width,
                height: labelSize.height,
            });
            bounds.extend(position);
        }

        if (!bounds.isEmpty()) state.map.setBounds(bounds);
        window.setTimeout(repositionLabels, 500);
    }

    function clearCanvas() {
        elements.labelCanvas.replaceChildren();
        const width = elements.map.offsetWidth;
        const height = elements.map.offsetHeight;
        elements.lineCanvas.width = width;
        elements.lineCanvas.height = height;
        elements.lineCanvas.getContext('2d').clearRect(0, 0, width, height);
    }

    function toPixels(latLng) {
        const projection = state.map.getProjection();
        const markerPoint = projection.pointFromCoords(latLng);
        const centerPoint = projection.pointFromCoords(state.map.getCenter());
        return {
            x: elements.map.offsetWidth / 2 + (markerPoint.x - centerPoint.x),
            y: elements.map.offsetHeight / 2 + (markerPoint.y - centerPoint.y),
        };
    }

    function scheduleReposition() {
        window.clearTimeout(state.repositionTimer);
        state.repositionTimer = window.setTimeout(repositionLabels, 180);
    }

    function overlaps(a, b) {
        return !(a.left + a.width + LABEL_PADDING < b.left
            || b.left + b.width + LABEL_PADDING < a.left
            || a.top + a.height + LABEL_PADDING < b.top
            || b.top + b.height + LABEL_PADDING < a.top);
    }

    function labelHitsMarker(label, markerItem) {
        const radius = MARKER_RADIUS + 3;
        return !(label.left + label.width + LABEL_PADDING < markerItem.markerX - radius
            || markerItem.markerX + radius + LABEL_PADDING < label.left
            || label.top + label.height + LABEL_PADDING < markerItem.markerY - radius
            || markerItem.markerY + radius + LABEL_PADDING < label.top);
    }

    function repositionLabels() {
        if (!state.map || state.placedLabels.length === 0) return;
        clearCanvas();

        const items = state.placedLabels.map(item => {
            const point = toPixels(item.position);
            return {
                names: item.names,
                markerX: point.x,
                markerY: point.y,
                width: item.width,
                height: item.height,
                left: point.x + MARKER_RADIUS + LABEL_GAP,
                top: point.y - item.height / 2,
            };
        });

        const globalY = items.reduce((sum, item) => sum + item.markerY, 0) / items.length;
        const settled = [];
        const step = 5;
        const maxXOffset = 320;
        const yRange = 80;

        for (const current of items) {
            const yBias = current.markerY > globalY ? 10 : current.markerY < globalY ? -10 : 0;
            const baseLeft = current.markerX + MARKER_RADIUS + LABEL_GAP;
            const baseTop = current.markerY - current.height / 2 + yBias;
            let best = { left: baseLeft, top: baseTop, score: Number.POSITIVE_INFINITY };

            for (let xOffset = 0; xOffset <= maxXOffset; xOffset += step) {
                for (let absYOffset = 0; absYOffset <= yRange; absYOffset += step) {
                    const offsets = absYOffset === 0
                        ? [0]
                        : [yBias < 0 ? -absYOffset : absYOffset, yBias < 0 ? absYOffset : -absYOffset];
                    for (const yOffset of offsets) {
                        const candidate = {
                            ...current,
                            left: baseLeft + xOffset,
                            top: baseTop + yOffset,
                        };
                        if (settled.some(item => overlaps(candidate, item))) continue;
                        if (items.some(item => item !== current && labelHitsMarker(candidate, item))) continue;

                        const outOfBoundsPenalty = Math.max(0, candidate.left + candidate.width - elements.map.offsetWidth) * 20
                            + Math.max(0, -candidate.top) * 20
                            + Math.max(0, candidate.top + candidate.height - elements.map.offsetHeight) * 20;
                        const score = xOffset * 0.5 + Math.abs(yOffset) * 0.1 + outOfBoundsPenalty;
                        if (score < best.score) best = { left: candidate.left, top: candidate.top, score };
                    }
                }
            }

            current.left = best.left;
            current.top = best.top;
            settled.push(current);
        }

        drawConnectorLines(settled);
        drawLabels(settled);
    }

    function drawConnectorLines(items) {
        const context = elements.lineCanvas.getContext('2d');
        for (const item of items) {
            const labelX = item.left;
            const labelY = item.top + item.height / 2;
            const markerX = item.markerX + MARKER_RADIUS + 1;
            const markerY = item.markerY;
            const elbowX = item.left - 6;

            context.beginPath();
            context.moveTo(markerX, markerY);
            if (Math.abs(markerY - labelY) < 4) {
                context.lineTo(labelX, labelY);
            } else {
                context.lineTo(elbowX, markerY);
                context.lineTo(elbowX, labelY);
                context.lineTo(labelX, labelY);
            }
            context.strokeStyle = 'rgba(255,255,255,0.85)';
            context.lineWidth = 4;
            context.setLineDash([]);
            context.stroke();
            context.strokeStyle = 'rgba(30,30,30,0.75)';
            context.lineWidth = 1.8;
            context.setLineDash([5, 3]);
            context.stroke();
            context.setLineDash([]);

            context.beginPath();
            context.arc(markerX, markerY, 3.5, 0, Math.PI * 2);
            context.fillStyle = '#fff';
            context.fill();
            context.beginPath();
            context.arc(markerX, markerY, 2.5, 0, Math.PI * 2);
            context.fillStyle = 'rgba(30,30,30,0.8)';
            context.fill();

            context.beginPath();
            context.moveTo(labelX, labelY);
            context.lineTo(labelX - 6, labelY - 4);
            context.lineTo(labelX - 6, labelY + 4);
            context.closePath();
            context.fillStyle = 'rgba(30,30,30,0.7)';
            context.fill();
        }
    }

    function drawLabels(items) {
        const fragment = document.createDocumentFragment();
        for (const item of items) {
            const label = document.createElement('div');
            if (item.names.length === 1) {
                label.className = item.names[0].length > 10 ? 'lbl wrap' : 'lbl';
                label.textContent = item.names[0];
            } else {
                label.className = 'lbl cluster';
                item.names.forEach((name, index) => {
                    const row = document.createElement('div');
                    row.textContent = `${index === 0 ? '●' : '·'} ${name}`;
                    label.appendChild(row);
                });
            }
            label.style.left = `${item.left}px`;
            label.style.top = `${item.top}px`;
            fragment.appendChild(label);
        }
        elements.labelCanvas.replaceChildren(fragment);
    }

    elements.initMap.addEventListener('click', initializeMap);
    elements.excelFile.addEventListener('change', handleExcelFile);
    elements.loadSample.addEventListener('click', loadSampleData);
    elements.search.addEventListener('input', event => renderSearchResults(event.target.value));
    elements.selectAll.addEventListener('click', selectVisibleClients);
    elements.clearSelected.addEventListener('click', clearSelectedClients);
    elements.print.addEventListener('click', () => window.print());
    elements.originAddress.addEventListener('change', async () => {
        if (!state.map || !state.geocoder) return;
        const address = elements.originAddress.value.trim();
        if (address) await setOriginAddress(address);
    });
    elements.clusterDistance.addEventListener('change', async () => {
        const distance = getClusterDistance();
        if (state.map && state.selectedClients.length > 0) {
            await updateMap();
        } else {
            setStatus(`클러스터 거리를 ${distance.toLocaleString()}m로 설정했습니다.`);
        }
    });

    renderSearchResults('');
    renderSelectedList();
    setStatus('샘플 거래처로 먼저 흐름을 확인하거나, Kakao JavaScript 키와 Excel 파일을 입력해 실제 데이터를 사용하세요.');
})();
