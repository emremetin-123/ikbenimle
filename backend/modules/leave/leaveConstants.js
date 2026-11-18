const LEAVE_TYPE_LABELS = {
    MESAI: 'MESAI',
    MAZERET: 'MAZERET',
    YILLIK_IZIN: 'YILLIK İZİN',
    DOGUM_IZNI: 'DOĞUM İZNİ',
    OLUM_IZNI: 'ÖLÜM İZNİ',
    EVLENME_IZNI: 'EVLENME İZNİ',
    SENDIKAL_IZNI: 'SENDİKAL İZNİ',
    TOPLU_IZIN: 'TOPLU İZİN',
    PLANLI_IZIN: 'PLANLI İZİN',
    GOREV_FORMU: 'GÖREV FORMU',
    VIZITE: 'VİZİTE',
    DEVAMSIZLIK: 'DEVAMSIZLIK',
    DIGER: 'DİĞER'
};

const LEAVE_TYPES = Object.values(LEAVE_TYPE_LABELS);
const VALID_STATUSES = ['İletildi', 'Beklemede', 'Onaylandı', 'Reddedildi'];

module.exports = { LEAVE_TYPE_LABELS, LEAVE_TYPES, VALID_STATUSES };
