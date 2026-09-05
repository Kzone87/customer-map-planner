(() => {
    const EARTH_RADIUS_M = 6_371_000;

    function distanceMeters(lat1, lng1, lat2, lng2) {
        const toRad = value => value * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a = Math.sin(dLat / 2) ** 2
            + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
        return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function clusterByDistance(points, thresholdMeters) {
        const visited = new Array(points.length).fill(false);
        const clusters = [];

        for (let start = 0; start < points.length; start += 1) {
            if (visited[start]) continue;

            const queue = [start];
            const group = [];
            visited[start] = true;

            while (queue.length > 0) {
                const currentIndex = queue.shift();
                const current = points[currentIndex];
                group.push(current);

                for (let candidateIndex = 0; candidateIndex < points.length; candidateIndex += 1) {
                    if (visited[candidateIndex]) continue;
                    const candidate = points[candidateIndex];
                    const distance = distanceMeters(
                        current.lat,
                        current.lng,
                        candidate.lat,
                        candidate.lng,
                    );
                    if (distance <= thresholdMeters) {
                        visited[candidateIndex] = true;
                        queue.push(candidateIndex);
                    }
                }
            }

            const lat = group.reduce((sum, item) => sum + item.lat, 0) / group.length;
            const lng = group.reduce((sum, item) => sum + item.lng, 0) / group.length;
            clusters.push({
                lat,
                lng,
                names: group.map(item => item.name),
                members: group,
            });
        }

        return clusters;
    }

    window.GeoUtils = Object.freeze({ distanceMeters, clusterByDistance });
})();
