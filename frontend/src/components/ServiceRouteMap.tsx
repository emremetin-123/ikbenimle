import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ServiceRoute, ServiceRouteStop } from '../types';
import {
    normalizeServiceColor,
    serviceMapHeightStyle,
} from '../service-routes/styleSupport';

type Point = { lat: number; lng: number };

type ServiceRouteMapProps = {
    route: Pick<ServiceRoute, 'stops' | 'color'>;
    geometry?: Point[];
    height?: number;
    activeStopIndex?: number | null;
    onPick?: (lat: number, lng: number) => void;
};

const defaultCenter: Point = { lat: 40.808, lng: 29.43 };

const validStops = (stops: ServiceRouteStop[]) => (
    stops.filter(stop => Number.isFinite(Number(stop.latitude)) && Number.isFinite(Number(stop.longitude)))
);

const centerOf = (stops: ServiceRouteStop[]): Point => {
    const valid = validStops(stops);
    if (!valid.length) return defaultCenter;
    return {
        lat: valid.reduce((sum, stop) => sum + Number(stop.latitude), 0) / valid.length,
        lng: valid.reduce((sum, stop) => sum + Number(stop.longitude), 0) / valid.length,
    };
};

const markerIcon = (color: string, active = false) => L.divIcon({
    className: '',
    iconSize: active ? [26, 26] : [21, 21],
    iconAnchor: active ? [13, 13] : [10.5, 10.5],
    html: `<span class="service-route-marker${active ? ' is-active' : ''}" style="--service-marker-color:${color}"></span>`,
});

export const ServiceRouteMap = ({ route, geometry = [], height = 460, activeStopIndex = null, onPick }: ServiceRouteMapProps) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<L.Map | null>(null);
    const layerRef = useRef<L.LayerGroup | null>(null);
    const lastFitKeyRef = useRef('');
    const color = normalizeServiceColor(route.color);

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;
        const center = centerOf(route.stops);
        const map = L.map(containerRef.current, {
            center: [center.lat, center.lng],
            zoom: 13,
            zoomControl: true,
            scrollWheelZoom: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap',
        }).addTo(map);

        layerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
            layerRef.current = null;
            lastFitKeyRef.current = '';
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const map = mapRef.current;
        const layer = layerRef.current;
        if (!map || !layer) return;

        layer.clearLayers();
        if (onPick) {
            map.off('click');
            map.on('click', event => onPick(Number(event.latlng.lat.toFixed(6)), Number(event.latlng.lng.toFixed(6))));
        } else {
            map.off('click');
        }

        const stopPoints = validStops(route.stops).map(stop => L.latLng(Number(stop.latitude), Number(stop.longitude)));
        const routePoints = (geometry.length ? geometry : stopPoints.map(point => ({ lat: point.lat, lng: point.lng })))
            .filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng))
            .map(point => L.latLng(point.lat, point.lng));

        if (routePoints.length >= 2) {
            L.polyline(routePoints, { color: 'white', weight: 10, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(layer);
            L.polyline(routePoints, { color, weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(layer);
        }

        route.stops.forEach((stop, index) => {
            if (!Number.isFinite(Number(stop.latitude)) || !Number.isFinite(Number(stop.longitude))) return;
            const isActive = index === activeStopIndex;
            const marker = L.marker([Number(stop.latitude), Number(stop.longitude)], {
                icon: markerIcon(color, isActive),
                draggable: Boolean(onPick && isActive),
            }).addTo(layer);
            const tooltip = document.createElement('span');
            tooltip.textContent = stop.name || `Durak ${index + 1}`;
            marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -12] });
            if (onPick && isActive) {
                marker.on('dragend', () => {
                    const position = marker.getLatLng();
                    onPick(Number(position.lat.toFixed(6)), Number(position.lng.toFixed(6)));
                });
            }
        });

        const fitKey = `${activeStopIndex ?? 'view'}:${route.stops.map(stop => `${stop.latitude},${stop.longitude}`).join('|')}`;
        if (stopPoints.length) {
            const bounds = L.latLngBounds(stopPoints);
            if (lastFitKeyRef.current !== fitKey) {
                map.fitBounds(bounds.pad(0.28), { maxZoom: onPick ? 16 : 15, animate: false });
                lastFitKeyRef.current = fitKey;
            }
        } else {
            const center = centerOf(route.stops);
            map.setView([center.lat, center.lng], 13);
            lastFitKeyRef.current = fitKey;
        }

        setTimeout(() => map.invalidateSize(), 0);
    }, [route, geometry, activeStopIndex, onPick, color]);

    return <div ref={containerRef} className="service-route-map" style={serviceMapHeightStyle(height)} />;
};
