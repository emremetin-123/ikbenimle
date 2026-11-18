const { AppError } = require('../../core/http');
const { parsePagination, paginatedResponse } = require('../../core/pagination');

const normalizeStop = (stop, index) => ({
    id: stop.id,
    route_id: stop.route_id,
    name: stop.name,
    arrival_time: stop.arrival_time || '',
    latitude: Number(stop.latitude),
    longitude: Number(stop.longitude),
    order_index: stop.order_index ?? index
});
const mapRoute = (route, stops) => ({
    ...route,
    direction: route.direction || '',
    plate: route.plate || '',
    driver_name: route.driver_name || '',
    driver_phone: route.driver_phone || '',
    notes: route.notes || '',
    color: route.color || '#2563eb',
    is_active: Boolean(route.is_active),
    stops: stops.map(normalizeStop)
});

function createServiceRouteService(repository) {
    return {
        async list(query, employeeView) {
            const pagination = parsePagination(query);
            const result = await repository.list({ query, pagination, employeeView });
            const groupedStops = new Map();
            result.stops.forEach((stop) => {
                const routeId = Number(stop.route_id);
                if (!groupedStops.has(routeId)) groupedStops.set(routeId, []);
                groupedStops.get(routeId).push(stop);
            });
            return paginatedResponse(
                result.routes.map(route => mapRoute(
                    route,
                    groupedStops.get(Number(route.id)) || []
                )),
                result.total,
                pagination.page,
                pagination.pageSize
            );
        },
        create(body, userId) {
            return repository.create(body, userId);
        },
        async update(id, body) {
            if (!await repository.update(id, body)) {
                throw new AppError(404, 'SERVICE_ROUTE_NOT_FOUND', 'Servis hattı bulunamadı.');
            }
        },
        async remove(id) {
            if (!await repository.remove(id)) {
                throw new AppError(404, 'SERVICE_ROUTE_NOT_FOUND', 'Servis hattı bulunamadı.');
            }
        }
    };
}

module.exports = { createServiceRouteService };
