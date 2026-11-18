const { ensureFound } = require('./catalogRouteSupport');

const LABELS = {
    department: 'Bölüm',
    role: 'Pozisyon',
    category: 'Kategori',
    skill: 'Beceri'
};

const createCatalogService = ({ db, repository, addAudit }) => {
    const audit = (req, data) => addAudit(db, req, data);
    const findRequired = async (type, id) => ensureFound(
        await repository.findById(type, id),
        LABELS[type]
    );

    const create = async (type, req) => {
        let id;
        if (type === 'department') {
            id = await repository.createDepartment({
                name: req.body.name,
                sourceName: req.body.source_department_name || null
            });
        } else if (type === 'role') {
            id = await repository.createRole({
                departmentId: req.body.department_id,
                name: req.body.name
            });
        } else if (type === 'category') {
            id = await repository.createCategory({
                departmentId: req.body.department_id,
                name: req.body.name
            });
        } else {
            id = await repository.createSkill({
                departmentId: req.body.department_id,
                categoryId: req.body.category_id === '' ? null : (req.body.category_id || null),
                name: req.body.name,
                description: req.body.description || null
            });
        }
        await audit(req, {
            entityType: type,
            entityId: id,
            action: 'created',
            newValue: req.body
        });
        return repository.findById(type, id);
    };

    const update = async (type, req) => {
        const current = await findRequired(type, req.params.id);
        if (type === 'department') {
            await repository.updateDepartment(req.params.id, {
                name: req.body.name,
                sourceName: req.body.source_department_name || null
            });
        } else if (type === 'role') {
            await repository.updateRole(req.params.id, req.body.name);
        } else if (type === 'category') {
            await repository.updateCategory(req.params.id, req.body.name);
        } else {
            await repository.updateSkill(req.params.id, {
                categoryId: req.body.category_id === '' ? null : (req.body.category_id || null),
                name: req.body.name,
                description: req.body.description || null
            });
        }
        await audit(req, {
            entityType: type,
            entityId: req.params.id,
            action: 'updated',
            oldValue: current,
            newValue: req.body
        });
        return repository.findById(type, req.params.id);
    };

    const setArchived = async (type, req) => {
        await findRequired(type, req.params.id);
        await repository.setArchived(type, req.params.id, {
            archived: req.body.archived,
            actorUserId: req.user.id,
            reason: req.body.reason
        });
        await audit(req, {
            entityType: type,
            entityId: req.params.id,
            action: req.body.archived ? 'archived' : 'restored',
            reason: req.body.reason
        });
        return { success: true };
    };

    const replaceSkillTrainings = async (req) => {
        await findRequired('skill', req.params.id);
        const videoIds = [...new Set(req.body.video_ids)];
        await repository.replaceSkillTrainings(req.params.id, videoIds);
        await audit(req, {
            entityType: 'skill',
            entityId: req.params.id,
            action: 'training_links_updated',
            newValue: { video_ids: videoIds }
        });
        return { success: true, video_ids: videoIds };
    };

    return { create, update, setArchived, replaceSkillTrainings };
};

module.exports = { createCatalogService };
