const test = require('node:test');
const assert = require('node:assert/strict');
const {
    distanceMeters,
    normalizeClusterDistance,
    clientKey,
    filterClients,
    clusterByDistance,
} = require('../geo.js');

test('distanceMeters returns zero for identical coordinates', () => {
    assert.equal(distanceMeters(37.5665, 126.9780, 37.5665, 126.9780), 0);
});

test('distanceMeters is approximately 111 km per degree of latitude', () => {
    const distance = distanceMeters(37, 127, 38, 127);
    assert.ok(distance > 110_000 && distance < 112_500, `unexpected distance: ${distance}`);
});

test('normalizeClusterDistance applies fallback and bounds', () => {
    assert.equal(normalizeClusterDistance('not-a-number'), 1000);
    assert.equal(normalizeClusterDistance(50), 100);
    assert.equal(normalizeClusterDistance(1500.4), 1500);
    assert.equal(normalizeClusterDistance(25_000), 10_000);
});

test('clientKey normalizes surrounding whitespace', () => {
    assert.equal(
        clientKey({ name: ' Alpha ', address: ' Seoul ' }),
        clientKey({ name: 'Alpha', address: 'Seoul' }),
    );
});

test('filterClients searches both name and address case-insensitively', () => {
    const clients = [
        { name: 'Alpha Print', address: '서울특별시 중구' },
        { name: 'Beta Office', address: 'Busan Haeundae' },
    ];

    assert.deepEqual(filterClients(clients, 'alpha'), [clients[0]]);
    assert.deepEqual(filterClients(clients, '해운'), []);
    assert.deepEqual(filterClients(clients, 'BUSAN'), [clients[1]]);
    assert.deepEqual(filterClients(clients, '서울'), [clients[0]]);
});

test('clusterByDistance keeps distant points separate', () => {
    const clusters = clusterByDistance([
        { name: 'A', lat: 37.5665, lng: 126.9780 },
        { name: 'B', lat: 37.5666, lng: 126.9781 },
        { name: 'C', lat: 37.5, lng: 127.1 },
    ], 1000);

    assert.equal(clusters.length, 2);
    assert.deepEqual(clusters.map(cluster => cluster.names), [['A', 'B'], ['C']]);
});

test('clusterByDistance uses transitive proximity instead of first-point anchoring', () => {
    const clusters = clusterByDistance([
        { name: 'A', lat: 37.0000, lng: 127.0000 },
        { name: 'B', lat: 37.0060, lng: 127.0000 },
        { name: 'C', lat: 37.0120, lng: 127.0000 },
    ], 800);

    assert.equal(clusters.length, 1);
    assert.deepEqual(clusters[0].names, ['A', 'B', 'C']);
});

test('cluster distance changes grouping deterministically', () => {
    const points = [
        { name: 'A', lat: 37.0000, lng: 127.0000 },
        { name: 'B', lat: 37.0040, lng: 127.0000 },
    ];

    assert.equal(clusterByDistance(points, 300).length, 2);
    assert.equal(clusterByDistance(points, 500).length, 1);
});
