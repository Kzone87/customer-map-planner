(() => {
    const REQUIRED_COLUMNS = ['거래처명', '주소'];
    const DEFAULT_CLUSTER_DISTANCE_M = 1000;
    const MARKER_RADIUS = 6;
    const LABEL_GAP = 10;
    const LABEL_PADDING = 6;
    const MAX_VISIBLE_RESULTS = 200;
    const GEOCODE_BATCH_SIZE = 5;
    const PREFERENCE_KEY = 'customer-map-planner.preferences.v1';

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
        mapUpdateTimer: null,
        allClients: [],
        selectedClients: [],
        failedClients: [],
        lastPoints: [],
        clusterCount: 0,
        geocodeCache: new Map(),
        isUpdating: false,
        resizeObserver: null,
    };

    const elements = {
        apiKey: document.getElementById('apiKeyInput'),
        originAddress: document.getElementById('originAddressInput'),
        clusterDistance: document.getElementById('clusterDistanceInput'),
        initMap: document.getElementById('initMapButton'),
        clearOrigin: document.getElementById('clearOriginButton'),
        excelFile: document.getElementById('excelFile'),
        loadSample: document.getElementById('loadSampleButton'),
        downloadSample: document.getElementById('downloadSampleButton'),
        clearData: document.getElementById('clearDataButton'),
        search: document.getElementById('searchInput'),
        selectAll: document.getElementById('selectAllButton'),
        searchList: document.getElementById('searchList'),
        selectedList: document.getElementById('selectedList'),
        clearSelected: document.getElementById('clearSelectedButton'),
        exportSelected: document.getElementById('exportSelectedButton'),
        print: document.getElementById('printButton'),
        failureSection: document.getElementById('failureSection'),
        failedList: document.getElementById('failedList'),
        retryAll: document.getElementById('retryAllButton'),
        fitMap: document.getElementById('fitMapButton'),
        refreshMap: document.getElementById('refreshMapButton'),
        mapMeta: document.getElementById('mapMeta'),
        status: document.getElementById('status'),
        allCount: document.getElementById('allCount'),
        selectedCount: document.getElementById('selectedCount'),
        mappedCount: document.getElementById('mappedCount'),
        failedCount: document.getElementById('failedCount'),
        map: document.getElementById('map'),
        mapWrap: document.getElementById('map-wrap'),
        lineCanvas: document.getElementById('line-canvas'),
        labelCanvas: document.getElementById('label-canvas'),
        measureBox: document.getElementById('measure-box'),
    };

    function setStatus(message, kind = 'info') {
        elements.status.textContent = message;
        elements.status.dataset.kind = kind;
    }

    function renderSummary() {
        elements.allCount.textContent = state.allClients.length.toLocaleString();
        elements.selectedCount.textContent = state.selectedClients.length.toLocaleString();
        elements.mappedCount.textContent = state.lastPoints.length.toLocaleString();
        elements.failedCount.textContent = state.failedClients.length.toLocaleString();

        if (!state.map) {
            elements.mapMeta.textContent = '지도를 연결하면 선택 거래처가 표시됩니다.';
            return;
        }

        if (state.selectedClients.length === 0) {
            elements.mapMeta.textContent = '표시할 거래처를 선택하세요.';
            return;
        }

        elements.mapMeta.textContent = `선택 ${state.selectedClients.length} · 표시 ${state.lastPoints.length} · 클러스터 ${state.clusterCount} · 실패 ${state.failedClients.length}`;
    }

    function restorePreferences() {
        try {
            const saved = JSON.parse(localStorage.getItem(PREFERENCE_KEY) || '{}');
            if (saved.clusterDistance) {
                elements.clusterDistance.value = String(GeoUtils.normalizeClusterDistance(saved.clusterDistance));
            }
        } catch (error) {
            console.warn('Unable to restore preferences', error);
        }
    }

    function savePreferences() {
        try {
            localStorage.setItem(PREFERENCE_KEY, JSON.stringify({ clusterDistance: getClusterDistance() }));
        } catch (error) {
            console.warn('Unable to save preferences', error);
        }
    }

    function loadKakaoSdk(appKey) {
        if (window.kakao?.maps) {
            return new Promise(resolve => window.kakao.maps.load(resolve));
        }

        const previous = document.querySelector('script[data-customer-map-kakao]');
        if (previous) previous.remove();

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.dataset.customerMapKakao = 'true';
            script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&libraries=services&autoload=false`;
            script.async = true;
            script.onload = () => {
                if (!window.kakao?.maps) {
                    reject(new Error('Kakao Maps SDK가 초기화되지 않았습니다. JavaScript 키와 도메인 설정을 확인하세요.'));
                    return;
                }
                window.kakao.maps.load(resolve);
            };
            script.onerror = () => {
                script.remove();
                reject(new Error('Kakao Maps SDK를 불러오지 못했습니다. 키와 허용 도메인을 확인하세요.'));
            };
            document.head.appendChild(script);
        });
    }

    function geocodeAddress(address) {
        const normalizedAddress = String(address || '').trim();
        if (!normalizedAddress) return Promise.resolve(null);

        if (state.geocodeCache.has(normalizedAddress)) {
            return Promise.resolve(state.geocodeCache.get(normalizedAddress));
        }

        return new Promise(resolve => {
            state.geocoder.addressSearch(normalizedAddress, (result, status) => {
                if (status !== kakao.maps.services.Status.OK || result.length === 0) {
                    state.geocodeCache.set(normalizedAddress, null);
                    resolve(null);
                    return;
                }
                const point = {
                    lat: Number(result[0].y),
                    lng: Number(result[0].x),
                };
                state.geocodeCache.set(normalizedAddress, point);
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

    function setupResizeObserver() {
        if (!('ResizeObserver' in window)) return;
        if (state.resizeObserver) state.resizeObserver.disconnect();
        state.resizeObserver = new ResizeObserver(() => {
            if (!state.map) return;
            state.map.relayout();
            window.clearTimeout(state.repositionTimer);
            state.repositionTimer = window.setTimeout(() => {
                fitMapToPoints();
                repositionLabels();
            }, 120);
        });
        state.resizeObserver.observe(elements.mapWrap);
    }

    async function initializeMap() {
        const appKey = elements.apiKey.value.trim();
        if (!appKey) {
            setStatus('Kakao JavaScript 키를 입력하세요.', 'error');
            elements.apiKey.focus();
            return;
        }

        elements.initMap.disabled = true;
        setStatus('Kakao Maps를 연결하고 있습니다…', 'working');

        try {
            await loadKakaoSdk(appKey);
            state.map = new kakao.maps.Map(elements.map, {
                center: new kakao.maps.LatLng(37.5665, 126.9780),
                level: 8,
            });
            state.geocoder = new kakao.maps.services.Geocoder();
            kakao.maps.event.addListener(state.map, 'idle', scheduleReposition);
            setupResizeObserver();

            const originAddress = elements.originAddress.value.trim();
            if (originAddress) {
                await setOriginAddress(originAddress, { quiet: true });
            }

            setStatus('지도 연결 완료. 선택한 거래처를 확인합니다.', 'success');
            if (state.selectedClients.length > 0) {
                await updateMap();
            } else {
                renderSummary();
            }
        } catch (error) {
            console.error(error);
            setStatus(error.message || '지도 초기화 중 오류가 발생했습니다.', 'error');
        } finally {
            elements.initMap.disabled = false;
        }
    }

    async function setOriginAddress(address, { quiet = false } = {}) {
        if (!state.map || !state.geocoder) return;
        const point = await geocodeAddress(address);
        if (!point) {
            state.originPosition = null;
            if (state.originMarker) state.originMarker.setMap(null);
            state.originMarker = null;
            if (!quiet) setStatus(`기준 주소를 찾지 못했습니다: ${address}`, 'error');
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
        fitMapToPoints();
        if (!quiet) setStatus('기준 위치를 반영했습니다.', 'success');
    }

    function clearOrigin() {
        elements.originAddress.value = '';
        state.originPosition = null;
        if (state.originMarker) state.originMarker.setMap(null);
        state.originMarker = null;
        fitMapToPoints();
        setStatus('기준 위치를 제거했습니다.');
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
            const key = GeoUtils.clientKey(client);
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
                    if (workbook.SheetNames.length === 0) throw new Error('Excel 시트를 찾지 못했습니다.');
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
        state.failedClients = [];
        state.lastPoints = [];
        state.clusterCount = 0;
        elements.search.value = '';
        renderSearchResults('');
        renderSelectedList();
        renderFailedList();
        clearClientMarkers();
        clearCanvas();
        renderSummary();
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
            clearClientData({ quiet: true });
            setStatus(error.message || 'Excel 처리 중 오류가 발생했습니다.', 'error');
        }
    }

    async function loadSampleData() {
        setClientData(SAMPLE_CLIENTS.map(client => ({ ...client })), {
            autoSelect: true,
            source: '샘플 데이터',
        });
        scheduleMapUpdate();
    }

    function downloadSampleExcel() {
        const sheet = XLSX.utils.json_to_sheet(SAMPLE_CLIENTS.map(client => ({ 거래처명: client.name, 주소: client.address })));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, sheet, '거래처');
        XLSX.writeFile(workbook, 'customer-map-planner-sample.xlsx');
        setStatus('샘플 Excel 파일을 만들었습니다.', 'success');
    }

    function exportSelectedExcel() {
        if (state.selectedClients.length === 0) {
            setStatus('내보낼 거래처를 먼저 선택하세요.', 'error');
            return;
        }
        const sheet = XLSX.utils.json_to_sheet(state.selectedClients.map(client => ({ 거래처명: client.name, 주소: client.address })));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, sheet, '선택 거래처');
        XLSX.writeFile(workbook, 'selected-customers.xlsx');
        setStatus(`선택 거래처 ${state.selectedClients.length}건을 Excel로 내보냈습니다.`, 'success');
    }

    function clearClientData({ quiet = false } = {}) {
        state.allClients = [];
        state.selectedClients = [];
        state.failedClients = [];
        state.lastPoints = [];
        state.clusterCount = 0;
        state.geocodeCache.clear();
        elements.excelFile.value = '';
        elements.search.value = '';
        renderSearchResults('');
        renderSelectedList();
        renderFailedList();
        clearClientMarkers();
        clearCanvas();
        renderSummary();
        if (!quiet) setStatus('거래처 작업 데이터를 비웠습니다. API 키와 지도 연결은 유지됩니다.');
    }

    function createListRow(client, { mode, onClick, selected = false } = {}) {
        const row = document.createElement('div');
        row.className = 'list-row';

        const button = document.createElement('button');
        button.type = 'button';
        if (mode === 'remove') {
            button.textContent = '×';
            button.className = 'danger';
        } else if (selected) {
            button.textContent = '✓';
            button.className = 'selected';
            button.disabled = true;
        } else {
            button.textContent = '+';
        }
        if (onClick) button.addEventListener('click', onClick);

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
        return GeoUtils.filterClients(state.allClients, query).slice(0, MAX_VISIBLE_RESULTS);
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

        const selectedKeys = new Set(state.selectedClients.map(GeoUtils.clientKey));
        const fragment = document.createDocumentFragment();
        for (const client of matches) {
            const selected = selectedKeys.has(GeoUtils.clientKey(client));
            fragment.appendChild(createListRow(client, {
                selected,
                onClick: selected ? null : () => addClient(client),
            }));
        }
        elements.searchList.replaceChildren(fragment);
    }

    function scheduleMapUpdate() {
        renderSummary();
        if (!state.map) return;
        window.clearTimeout(state.mapUpdateTimer);
        state.mapUpdateTimer = window.setTimeout(() => updateMap(), 220);
    }

    function addClient(client) {
        if (state.selectedClients.some(item => GeoUtils.clientKey(item) === GeoUtils.clientKey(client))) return;
        state.selectedClients.push(client);
        renderSearchResults(elements.search.value);
        renderSelectedList();
        scheduleMapUpdate();
    }

    function selectVisibleClients() {
        const existing = new Set(state.selectedClients.map(GeoUtils.clientKey));
        for (const client of getVisibleClients()) {
            const key = GeoUtils.clientKey(client);
            if (!existing.has(key)) {
                state.selectedClients.push(client);
                existing.add(key);
            }
        }
        renderSearchResults(elements.search.value);
        renderSelectedList();
        if (!state.map) setStatus(`현재 목록에서 ${state.selectedClients.length}건을 선택했습니다.`, 'success');
        scheduleMapUpdate();
    }

    function removeClient(client) {
        const key = GeoUtils.clientKey(client);
        state.selectedClients = state.selectedClients.filter(item => GeoUtils.clientKey(item) !== key);
        state.failedClients = state.failedClients.filter(item => item.client !== client);
        renderSearchResults(elements.search.value);
        renderSelectedList();
        renderFailedList();
        scheduleMapUpdate();
    }

    function clearSelectedClients() {
        state.selectedClients = [];
        state.failedClients = [];
        state.lastPoints = [];
        state.clusterCount = 0;
        renderSearchResults(elements.search.value);
        renderSelectedList();
        renderFailedList();
        clearClientMarkers();
        clearCanvas();
        renderSummary();
        setStatus('지도 표시 목록을 비웠습니다.');
    }

    function renderSelectedList() {
        if (state.selectedClients.length === 0) {
            renderEmpty(elements.selectedList, '표시할 거래처가 없습니다.');
            return;
        }

        const fragment = document.createDocumentFragment();
        for (const client of state.selectedClients) {
            fragment.appendChild(createListRow(client, {
                mode: 'remove',
                onClick: () => removeClient(client),
            }));
        }
        elements.selectedList.replaceChildren(fragment);
    }

    function renderFailedList() {
        elements.failureSection.hidden = state.failedClients.length === 0;
        if (state.failedClients.length === 0) {
            elements.failedList.replaceChildren();
            renderSummary();
            return;
        }

        const fragment = document.createDocumentFragment();
        for (const failure of state.failedClients) {
            const wrapper = document.createElement('div');
            wrapper.className = 'failure-row';
            const title = document.createElement('strong');
            title.textContent = failure.client.name;
            const edit = document.createElement('div');
            edit.className = 'failure-edit';
            const input = document.createElement('input');
            input.type = 'text';
            input.value = failure.client.address;
            input.setAttribute('aria-label', `${failure.client.name} 주소 수정`);
            const retry = document.createElement('button');
            retry.type = 'button';
            retry.textContent = '재시도';
            retry.addEventListener('click', () => retryFailedClient(failure.client, input.value));
            edit.append(input, retry);
            wrapper.append(title, edit);
            fragment.appendChild(wrapper);
        }
        elements.failedList.replaceChildren(fragment);
        renderSummary();
    }

    async function retryFailedClient(client, newAddress) {
        const normalized = String(newAddress || '').trim();
        if (!normalized) {
            setStatus('재시도할 주소를 입력하세요.', 'error');
            return;
        }
        const previousAddress = client.address;
        client.address = normalized;
        state.geocodeCache.delete(previousAddress);
        state.geocodeCache.delete(normalized);
        renderSearchResults(elements.search.value);
        renderSelectedList();
        await updateMap();
    }

    async function retryAllFailures() {
        for (const failure of state.failedClients) {
            state.geocodeCache.delete(failure.client.address);
        }
        await updateMap();
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

    async function geocodeSelectedClients() {
        const points = [];
        const failed = [];
        const selected = [...state.selectedClients];

        for (let offset = 0; offset < selected.length; offset += GEOCODE_BATCH_SIZE) {
            const batch = selected.slice(offset, offset + GEOCODE_BATCH_SIZE);
            const results = await Promise.all(batch.map(async client => {
                const point = await geocodeAddress(client.address);
                return { client, point };
            }));

            for (const result of results) {
                if (result.point) {
                    points.push({ ...result.point, name: result.client.name, address: result.client.address, client: result.client });
                } else {
                    failed.push({ client: result.client });
                }
            }

            const completed = Math.min(offset + batch.length, selected.length);
            setStatus(`주소 확인 ${completed}/${selected.length} · 성공 ${points.length} · 실패 ${failed.length}`, 'working');
        }

        return { points, failed };
    }

    async function updateMap() {
        if (!state.map || !state.geocoder || state.isUpdating) return;
        window.clearTimeout(state.mapUpdateTimer);
        clearClientMarkers();
        clearCanvas();

        if (state.selectedClients.length === 0) {
            state.lastPoints = [];
            state.failedClients = [];
            state.clusterCount = 0;
            renderFailedList();
            renderSummary();
            return;
        }

        state.isUpdating = true;
        elements.refreshMap.disabled = true;
        setStatus(`선택 거래처 ${state.selectedClients.length}건의 주소를 확인합니다…`, 'working');

        try {
            const { points, failed } = await geocodeSelectedClients();
            state.lastPoints = points;
            state.failedClients = failed;
            renderFailedList();

            if (points.length === 0) {
                state.clusterCount = 0;
                renderSummary();
                setStatus('선택한 거래처의 주소를 모두 확인하지 못했습니다. 실패 목록에서 주소를 수정해 재시도하세요.', 'error');
                return;
            }

            const clusterDistance = getClusterDistance();
            state.clusterCount = buildMarkers(points, clusterDistance);
            renderSummary();
            const suffix = failed.length > 0 ? ` · 주소 확인 실패 ${failed.length}건` : '';
            setStatus(`지도에 ${points.length}건을 표시했습니다 · 클러스터 ${state.clusterCount}개 · 기준 ${clusterDistance.toLocaleString()}m${suffix}.`, failed.length ? 'info' : 'success');
        } catch (error) {
            console.error(error);
            setStatus(error.message || '지도 갱신 중 오류가 발생했습니다.', 'error');
        } finally {
            state.isUpdating = false;
            elements.refreshMap.disabled = false;
        }
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
        }

        fitMapToPoints();
        window.setTimeout(repositionLabels, 420);
        return clusters.length;
    }

    function fitMapToPoints() {
        if (!state.map) return;
        const bounds = new kakao.maps.LatLngBounds();
        let hasPoint = false;

        if (state.originPosition) {
            bounds.extend(state.originPosition);
            hasPoint = true;
        }
        for (const point of state.lastPoints) {
            bounds.extend(new kakao.maps.LatLng(point.lat, point.lng));
            hasPoint = true;
        }

        if (hasPoint) state.map.setBounds(bounds);
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
        state.repositionTimer = window.setTimeout(repositionLabels, 160);
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
        const maxXOffset = Math.min(320, Math.max(120, elements.map.offsetWidth * 0.3));
        const yRange = Math.min(100, Math.max(50, elements.map.offsetHeight * 0.12));

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
    elements.clearOrigin.addEventListener('click', clearOrigin);
    elements.excelFile.addEventListener('change', handleExcelFile);
    elements.loadSample.addEventListener('click', loadSampleData);
    elements.downloadSample.addEventListener('click', downloadSampleExcel);
    elements.clearData.addEventListener('click', () => clearClientData());
    elements.search.addEventListener('input', event => renderSearchResults(event.target.value));
    elements.selectAll.addEventListener('click', selectVisibleClients);
    elements.clearSelected.addEventListener('click', clearSelectedClients);
    elements.exportSelected.addEventListener('click', exportSelectedExcel);
    elements.retryAll.addEventListener('click', retryAllFailures);
    elements.fitMap.addEventListener('click', () => {
        fitMapToPoints();
        window.setTimeout(repositionLabels, 200);
    });
    elements.refreshMap.addEventListener('click', updateMap);
    elements.print.addEventListener('click', () => {
        if (!state.map || state.lastPoints.length === 0) {
            setStatus('인쇄할 지도를 먼저 생성하세요.', 'error');
            return;
        }
        window.print();
    });

    elements.originAddress.addEventListener('change', async () => {
        if (!state.map || !state.geocoder) return;
        const address = elements.originAddress.value.trim();
        if (address) await setOriginAddress(address);
        else clearOrigin();
    });

    elements.clusterDistance.addEventListener('change', () => {
        const distance = getClusterDistance();
        savePreferences();
        if (state.map && state.selectedClients.length > 0) scheduleMapUpdate();
        else setStatus(`클러스터 거리를 ${distance.toLocaleString()}m로 설정했습니다.`);
    });

    window.addEventListener('beforeprint', () => {
        if (!state.map) return;
        state.map.relayout();
        fitMapToPoints();
        window.setTimeout(repositionLabels, 80);
    });
    window.addEventListener('afterprint', () => {
        if (!state.map) return;
        state.map.relayout();
        fitMapToPoints();
        window.setTimeout(repositionLabels, 120);
    });

    restorePreferences();
    renderSearchResults('');
    renderSelectedList();
    renderFailedList();
    renderSummary();
    setStatus('샘플 데이터로 흐름을 확인하거나 Excel을 불러온 뒤, Kakao JavaScript 키를 입력해 실제 지도를 생성하세요.');
})();
