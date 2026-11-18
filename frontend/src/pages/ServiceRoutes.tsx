import { ModulePageHeader } from '../components/ModulePageHeader';
import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BusFront, Clock, ExternalLink, MapPin, Navigation, Phone, Route } from 'lucide-react';
import { api } from '../services/api';
import { queryKeys } from '../queryClient';
import { PaginationControls } from '../components/PaginationControls';
import type { ServiceRoute, ServiceRouteStop } from '../types';
import { ServiceRouteMap } from '../components/ServiceRouteMap';
import { serviceRouteStyle } from '../service-routes/styleSupport';
import { LoadingIndicator } from '../components/LoadingIndicator';

type Point = { lat: number; lng: number };

const googleStopDirectionsUrl = (stop: ServiceRouteStop) => {
    const destination = `${stop.latitude},${stop.longitude}`;
    return `https://www.google.com/maps/dir/?${new URLSearchParams({ api: '1', destination, travelmode: 'driving' }).toString()}`;
};

export const ServiceRoutes = () => {
    const [page, setPage] = useState(1);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const routesQuery = useQuery({
        queryKey: [...queryKeys.employeeServiceRoutes, page],
        queryFn: () => api.list<ServiceRoute>(
            `/api/service-routes?page=${page}&pageSize=10&status=active&sort=name&order=asc`
        )
    });
    const routes = useMemo(
        () => routesQuery.data?.items || [],
        [routesQuery.data?.items]
    );

    const selected = useMemo(
        () => routes.find(line => line.id === selectedId) || routes[0] || null,
        [routes, selectedId]
    );

    const validStops = useMemo(
        () => (selected?.stops || []).filter(
            stop => Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude)
        ),
        [selected]
    );
    const geometryKey = validStops
        .map(stop => `${stop.longitude},${stop.latitude}`)
        .join(';');
    const geometryQuery = useQuery({
        queryKey: ['service-route-geometry', selected?.id, geometryKey],
        queryFn: async () => {
            const response = await fetch(
                `https://router.project-osrm.org/route/v1/driving/${geometryKey}?overview=full&geometries=geojson`
            );
            if (!response.ok) throw new Error('Rota alınamadı.');
            const data = await response.json();
            const coordinates = data?.routes?.[0]?.geometry?.coordinates;
            if (!Array.isArray(coordinates)) throw new Error('Rota geometrisi bulunamadı.');
            return coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng }));
        },
        enabled: validStops.length >= 2,
        retry: 1,
        staleTime: 10 * 60_000
    });
    const routeGeometry: Point[] = geometryQuery.data
        || validStops.map(stop => ({ lat: stop.latitude, lng: stop.longitude }));

    if (routesQuery.isLoading) {
        return <LoadingIndicator label="Servis güzergahları yükleniyor" />;
    }

    if (!selected) {
        return (
            <div className="service-routes-page">
                <ModulePageHeader title="Servis Güzergahlarım" description="Servis hatlarını, durak saatlerini ve iletişim bilgilerini görüntüleyin." icon={<BusFront />} tone="teal" />
                <div className="premium-card service-route-state service-route-state-empty">
                    <p>
                        {routesQuery.error instanceof Error
                            ? routesQuery.error.message
                            : 'Henüz servis güzergahı tanımlanmadı.'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="service-routes-page">
            <ModulePageHeader title="Servis Güzergahlarım" description="Hat kartını seçerek güzergahı, durak saatlerini, plaka ve iletişim bilgilerini görüntüleyin." icon={<BusFront />} tone="teal" />

            <div className="service-route-layout">
                <section className="service-route-list">
                    {routes.map(line => {
                        const isActive = selected.id === line.id;
                        return (
                            <button
                                key={line.id}
                                type="button"
                                onClick={() => setSelectedId(line.id)}
                                className={`premium-card service-route-choice${isActive ? ' is-active' : ''}`}
                                style={serviceRouteStyle(line.color, { ring: true })}
                            >
                                <div className="service-route-choice-header">
                                    <div>
                                        <strong>{line.name}</strong>
                                        <div>{line.direction || 'Güzergah açıklaması yok'}</div>
                                    </div>
                                    <span className="service-route-color-dot" />
                                </div>
                                <div className="service-route-choice-meta">
                                    <span><Route size={15} /> {line.stops.length} durak</span>
                                    <span><Clock size={15} /> {line.stops[0]?.arrival_time || '-'} kalkış</span>
                                    <span><BusFront size={15} /> {line.plate || 'Plaka yok'}</span>
                                    <span><Phone size={15} /> {line.driver_name || 'Şoför yok'}</span>
                                </div>
                            </button>
                        );
                    })}
                    <PaginationControls
                        pagination={routesQuery.data?.pagination}
                        onPageChange={nextPage => {
                            setPage(nextPage);
                            setSelectedId(null);
                        }}
                    />
                </section>

                <section
                    className="premium-card service-route-detail"
                    style={serviceRouteStyle(selected.color, { soft: true })}
                >
                    <div className="service-route-detail-header">
                        <div>
                            <h2>{selected.name}</h2>
                            <p>{selected.direction}</p>
                        </div>
                        <div className="service-route-detail-actions">
                            {selected.driver_phone && (
                                <a href={`tel:${selected.driver_phone.replace(/\s+/g, '')}`} className="btn-secondary service-route-phone">
                                    <Phone size={17} /> Şoförü Ara
                                </a>
                            )}
                        </div>
                    </div>

                    <ServiceRouteMap route={selected} geometry={routeGeometry} height={460} />

                    <div className="service-route-detail-body">
                        <div className="responsive-grid-3 service-route-info-grid">
                            <InfoTile icon={<BusFront size={18} />} label="Plaka" value={selected.plate || '-'} />
                            <InfoTile icon={<Phone size={18} />} label="İletişim" value={selected.driver_phone || '-'} />
                            <InfoTile icon={<Navigation size={18} />} label="Not" value={selected.notes || '-'} />
                        </div>

                        <div className="service-route-stop-list">
                            {selected.stops.map((stop) => (
                                <div key={`${stop.name}-${stop.order_index}`} className="service-route-stop">
                                    <strong>{stop.arrival_time || '-'}</strong>
                                    <span className="service-route-stop-marker">
                                        <MapPin size={15} />
                                    </span>
                                    <span>{stop.name}</span>
                                    <a href={googleStopDirectionsUrl(stop)} target="_blank" rel="noreferrer" className="btn-icon service-route-directions" title="Bu durağa yol tarifi al">
                                        <ExternalLink size={17} />
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

const InfoTile = ({ icon, label, value }: { icon: ReactNode; label: string; value: string }) => (
    <div className="service-route-info-tile">
        <div>
            {icon} {label}
        </div>
        <strong>{value}</strong>
    </div>
);
