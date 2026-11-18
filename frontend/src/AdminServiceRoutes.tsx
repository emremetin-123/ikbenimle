import { ModulePageHeader } from './components/ModulePageHeader';
import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BusFront, Edit, LocateFixed, MapPin, Plus, Save, Search, Trash2, X } from 'lucide-react';
import { api } from './services/api';
import { queryKeys } from './queryClient';
import { PaginationControls } from './components/PaginationControls';
import type { ServiceRoute, ServiceRouteStop } from './types';
import { ServiceRouteMap } from './components/ServiceRouteMap';
import { serviceRouteStyle } from './service-routes/styleSupport';
import { useAppFeedback } from './components/AppFeedback';
import { ModalShell } from './components/ModalShell';

type DraftRoute = {
    id?: number;
    name: string;
    direction: string;
    plate: string;
    driver_name: string;
    driver_phone: string;
    notes: string;
    color: string;
    is_active: boolean;
    stops: ServiceRouteStop[];
};

type SearchResult = {
    display_name: string;
    lat: string;
    lon: string;
};

const emptyStop = (order = 0): ServiceRouteStop => ({
    name: '',
    arrival_time: '',
    latitude: 40.808,
    longitude: 29.43,
    order_index: order,
});

const emptyRoute = (): DraftRoute => ({
    name: '',
    direction: '',
    plate: '',
    driver_name: '',
    driver_phone: '',
    notes: '',
    color: '#2563eb',
    is_active: true,
    stops: [emptyStop(0), emptyStop(1)],
});

const toDraft = (route: ServiceRoute): DraftRoute => ({
    id: route.id,
    name: route.name,
    direction: route.direction || '',
    plate: route.plate || '',
    driver_name: route.driver_name || '',
    driver_phone: route.driver_phone || '',
    notes: route.notes || '',
    color: route.color || '#2563eb',
    is_active: Boolean(route.is_active),
    stops: route.stops.length ? route.stops : [emptyStop(0), emptyStop(1)],
});

const parseCoordinates = (value: string) => {
    const decoded = decodeURIComponent(value);
    const atMatch = decoded.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (atMatch) return { lat: Number(atMatch[1]), lng: Number(atMatch[2]) };
    const qMatch = decoded.match(/[?&](?:q|query|destination)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (qMatch) return { lat: Number(qMatch[1]), lng: Number(qMatch[2]) };
    const bangMatch = decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (bangMatch) return { lat: Number(bangMatch[1]), lng: Number(bangMatch[2]) };
    const plainMatch = decoded.match(/(-?\d{1,2}\.\d{4,})\s*,\s*(-?\d{1,3}\.\d{4,})/);
    if (plainMatch) return { lat: Number(plainMatch[1]), lng: Number(plainMatch[2]) };
    return null;
};

export const AdminServiceRoutes = () => {
    const feedback = useAppFeedback();
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [draft, setDraft] = useState<DraftRoute>(emptyRoute());
    const [message, setMessage] = useState('');
    const [editorOpen, setEditorOpen] = useState(false);
    const [activeStopIndex, setActiveStopIndex] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

    const activeStop = activeStopIndex !== null ? draft.stops[activeStopIndex] : null;
    const pickerRoute = useMemo(() => ({
        id: draft.id || 0,
        name: draft.name,
        color: draft.color,
        stops: draft.stops,
    }), [draft]);

    const routesQuery = useQuery({
        queryKey: [...queryKeys.adminServiceRoutes, page],
        queryFn: () => api.list<ServiceRoute>(
            `/api/admin/service-routes?page=${page}&pageSize=10&status=all&sort=name&order=asc`
        )
    });
    const routes = routesQuery.data?.items || [];

    const refreshRoutes = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: queryKeys.adminServiceRoutes }),
            queryClient.invalidateQueries({ queryKey: queryKeys.employeeServiceRoutes })
        ]);
    };

    const saveRouteMutation = useMutation({
        mutationFn: (payload: DraftRoute) => payload.id
            ? api.put(`/api/admin/service-routes/${payload.id}`, payload)
            : api.post('/api/admin/service-routes', payload),
        onSuccess: async (_, payload) => {
            setMessage(payload.id ? 'Servis hattı güncellendi.' : 'Servis hattı oluşturuldu.');
            setDraft(emptyRoute());
            setEditorOpen(false);
            await refreshRoutes();
        },
        onError: error => setMessage(
            error instanceof Error ? error.message : 'Servis hattı kaydedilemedi.'
        )
    });

    const deleteRouteMutation = useMutation({
        mutationFn: (route: ServiceRoute) => api.delete(
            `/api/admin/service-routes/${route.id}`
        ),
        onSuccess: async (_, route) => {
            if (draft.id === route.id) setDraft(emptyRoute());
            setMessage('Servis hattı silindi.');
            await refreshRoutes();
        },
        onError: error => setMessage(
            error instanceof Error ? error.message : 'Servis hattı silinemedi.'
        )
    });

    const locationSearch = useMutation({
        mutationFn: async (query: string) => {
            const params = new URLSearchParams({
                format: 'json',
                limit: '10',
                countrycodes: 'tr',
                addressdetails: '1',
                dedupe: '1',
                q: query
            });
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?${params.toString()}`
            );
            if (!response.ok) throw new Error('Konum araması yapılamadı.');
            const data = await response.json();
            return Array.isArray(data) ? data as SearchResult[] : [];
        },
        onSuccess: setSearchResults,
        onError: error => setMessage(
            error instanceof Error ? error.message : 'Konum araması yapılamadı.'
        )
    });

    const updateStop = (index: number, patch: Partial<ServiceRouteStop>) => {
        setDraft(prev => ({
            ...prev,
            stops: prev.stops.map((stop, stopIndex) => stopIndex === index ? { ...stop, ...patch } : stop),
        }));
    };

    const openStopPicker = (index: number) => {
        setActiveStopIndex(index);
        setSearchTerm(draft.stops[index]?.name || '');
        setSearchResults([]);
    };

    const addStop = () => {
        setDraft(prev => ({ ...prev, stops: [...prev.stops, emptyStop(prev.stops.length)] }));
    };

    const removeStop = (index: number) => {
        setDraft(prev => ({ ...prev, stops: prev.stops.length <= 2 ? prev.stops : prev.stops.filter((_, stopIndex) => stopIndex !== index) }));
    };

    const searchLocation = () => {
        const query = searchTerm.trim();
        if (!query) return;
        const coordinate = parseCoordinates(query);
        if (coordinate) {
            selectLocation(coordinate.lat, coordinate.lng);
            return;
        }
        locationSearch.mutate(query);
    };

    const selectLocation = (lat: number, lng: number, name?: string) => {
        if (activeStopIndex === null) return;
        updateStop(activeStopIndex, {
            latitude: Number(lat.toFixed(6)),
            longitude: Number(lng.toFixed(6)),
            name: draft.stops[activeStopIndex].name || name || '',
        });
    };

    const saveRoute = (event: FormEvent) => {
        event.preventDefault();
        setMessage('');
        const payload = {
            ...draft,
            stops: draft.stops.map((stop, index) => ({
                ...stop,
                latitude: Number(stop.latitude),
                longitude: Number(stop.longitude),
                order_index: index,
            })),
        };

        saveRouteMutation.mutate(payload);
    };

    const deleteRoute = async (route: ServiceRoute) => {
        if (!await feedback.confirm({
            title: 'Servis hattını sil',
            message: `"${route.name}" hattı kalıcı olarak silinecek.`,
            confirmLabel: 'Hattı Sil',
            danger: true,
        })) return;
        deleteRouteMutation.mutate(route);
    };

    const openNewRoute = () => { setDraft(emptyRoute()); setEditorOpen(true); };

    return (
        <div className="service-admin-page">
            <ModulePageHeader title="Servis Güzergahları İşlemleri" description="Hat bilgilerini girin, durakları arama veya haritadan seçme yöntemiyle kaydedin." icon={<BusFront />} tone="teal" actions={
                <button type="button" className="btn-primary module-mobile-only" onClick={openNewRoute}><Plus size={17} /> Yeni Hat</button>
            } />
            {message && <div className="module-page-notice" role="status">{message}</div>}

            <div className="service-admin-layout">
                <section className="premium-card service-route-sidebar">
                    <button type="button" className="btn-primary service-new-route-button module-desktop-only" onClick={openNewRoute}>
                        <Plus size={17} /> Yeni Hat
                    </button>
                    {routes.length === 0 ? (
                        <div className="service-admin-empty">
                            Henüz servis hattı eklenmedi.
                        </div>
                    ) : routes.map(route => (
                        <div
                            key={route.id}
                            className={`service-route-card ${draft.id === route.id ? 'active' : ''}`}
                            style={serviceRouteStyle(route.color)}
                        >
                            <div className="service-route-card-header">
                                <div>
                                    <strong>{route.name}</strong>
                                    <div className="service-route-card-meta">
                                        {route.plate || 'Plaka yok'} · {route.stops.length} durak · {route.is_active ? 'Aktif' : 'Pasif'}
                                    </div>
                                </div>
                                <span className="service-route-color-dot" />
                            </div>
                            <div className="service-route-actions">
                                <button type="button" className="service-route-edit-button" onClick={() => { setDraft(toDraft(route)); setEditorOpen(true); }}>
                                    <Edit size={15} /> Düzenle
                                </button>
                                <button type="button" className="service-route-delete-button" onClick={() => deleteRoute(route)} title="Sil">
                                    <Trash2 size={17} />
                                </button>
                            </div>
                        </div>
                    ))}
                    <PaginationControls
                        pagination={routesQuery.data?.pagination}
                        onPageChange={setPage}
                    />
                </section>

                {editorOpen && (
                <ModalShell onClose={() => setEditorOpen(false)} labelledBy="service-route-editor-title" className="admin-action-modal">
                    <div className="admin-modal-header">
                        <h3 id="service-route-editor-title">{draft.id ? 'Servis Hattını Düzenle' : 'Yeni Servis Hattı'}</h3>
                        <button type="button" className="admin-modal-close" onClick={() => setEditorOpen(false)} title="Kapat">
                            <X size={18} />
                        </button>
                    </div>
                    <form
                        onSubmit={saveRoute}
                        className="service-admin-form"
                        style={serviceRouteStyle(draft.color, { soft: true })}
                    >
                        <div className="responsive-grid-3 service-admin-fields">
                            <Field label="Hat Adı"><input className="form-control" value={draft.name} onChange={event => setDraft(prev => ({ ...prev, name: event.target.value }))} required /></Field>
                            <Field label="Güzergah Açıklaması"><input className="form-control" value={draft.direction} onChange={event => setDraft(prev => ({ ...prev, direction: event.target.value }))} placeholder="Gebze - İmortaş" /></Field>
                            <Field label="Renk"><input className="form-control" type="color" value={draft.color} onChange={event => setDraft(prev => ({ ...prev, color: event.target.value }))} /></Field>
                            <Field label="Plaka"><input className="form-control" value={draft.plate} onChange={event => setDraft(prev => ({ ...prev, plate: event.target.value }))} /></Field>
                            <Field label="Şoför"><input className="form-control" value={draft.driver_name} onChange={event => setDraft(prev => ({ ...prev, driver_name: event.target.value }))} /></Field>
                            <Field label="İletişim"><input className="form-control" value={draft.driver_phone} onChange={event => setDraft(prev => ({ ...prev, driver_phone: event.target.value }))} /></Field>
                        </div>
                        <Field label="Not">
                            <textarea className="form-control" rows={2} value={draft.notes} onChange={event => setDraft(prev => ({ ...prev, notes: event.target.value }))} />
                        </Field>
                        <label className="service-active-toggle">
                            <input type="checkbox" checked={draft.is_active} onChange={event => setDraft(prev => ({ ...prev, is_active: event.target.checked }))} />
                            Çalışanlara göster
                        </label>

                        <div className="service-admin-stops">
                            <div className="service-section-toolbar">
                                <h3>Duraklar</h3>
                                <button type="button" className="service-add-stop-button" onClick={addStop}>
                                    <Plus size={16} /> Durak Ekle
                                </button>
                            </div>
                            {draft.stops.map((stop, index) => (
                                <div key={index} className="service-stop-grid service-stop-row">
                                    <span className="service-stop-index">
                                        <MapPin size={16} />
                                    </span>
                                    <input className="form-control" placeholder="Durak adı" value={stop.name} onChange={event => updateStop(index, { name: event.target.value })} required />
                                    <input className="form-control" type="time" value={stop.arrival_time || ''} onChange={event => updateStop(index, { arrival_time: event.target.value })} />
                                    <button type="button" className="service-location-button" onClick={() => openStopPicker(index)}>
                                        <LocateFixed size={16} /> Konum Seç
                                    </button>
                                    <span className="service-coordinate-pill">
                                        {Number(stop.latitude).toFixed(5)}, {Number(stop.longitude).toFixed(5)}
                                    </span>
                                    <button type="button" className="btn-icon" onClick={() => removeStop(index)} title="Durağı sil">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="admin-modal-actions">
                            <button type="button" className="btn-cancel service-modal-secondary" onClick={() => setEditorOpen(false)}>İptal</button>
                            <button type="submit" className="btn-primary service-save-route-button" disabled={saveRouteMutation.isPending}>
                            <Save size={18} /> {saveRouteMutation.isPending ? 'Kaydediliyor...' : draft.id ? 'Hattı Güncelle' : 'Hattı Kaydet'}
                            </button>
                        </div>
                    </form>
                </ModalShell>
                )}
            </div>

            {activeStopIndex !== null && activeStop && (
                <ModalShell onClose={() => setActiveStopIndex(null)} labelledBy="service-location-title" className="service-location-modal">
                        <div className="service-location-header">
                            <div>
                                <h3 id="service-location-title">Durak Konumu Seç</h3>
                                <p>{activeStop.name || `Durak ${activeStopIndex + 1}`}</p>
                            </div>
                            <button type="button" className="admin-modal-close" onClick={() => setActiveStopIndex(null)} title="Kapat">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="service-location-layout">
                            <aside className="service-location-sidebar">
                                <div className="service-location-search">
                                    <input className="form-control" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); searchLocation(); } }} placeholder="Durak veya adres ara" />
                                    <button type="button" className="btn-primary service-location-search-button" onClick={searchLocation} disabled={locationSearch.isPending}>
                                        <Search size={17} />
                                    </button>
                                </div>
                                <div className="service-location-results">
                                    {searchResults.map(result => (
                                        <button
                                            key={`${result.lat}-${result.lon}`}
                                            type="button"
                                            onClick={() => selectLocation(Number(result.lat), Number(result.lon), result.display_name.split(',')[0])}
                                            className="service-location-result"
                                        >
                                            {result.display_name}
                                        </button>
                                    ))}
                                </div>
                                <div className="service-location-help">
                                    Haritada istediğiniz noktaya tıklayarak durağın konumunu değiştirebilirsiniz.
                                </div>
                            </aside>
                            <ServiceRouteMap
                                route={pickerRoute}
                                activeStopIndex={activeStopIndex}
                                onPick={selectLocation}
                                height={420}
                            />
                        </div>
                        <div className="admin-modal-actions">
                            <button type="button" className="btn-secondary service-modal-secondary" onClick={() => setActiveStopIndex(null)}>Kapat</button>
                            <button type="button" className="btn-primary service-modal-primary" onClick={() => setActiveStopIndex(null)}>Konumu Kullan</button>
                        </div>
                </ModalShell>
            )}
        </div>
    );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <label className="input-group service-field">
        <span className="input-label">{label}</span>
        {children}
    </label>
);
