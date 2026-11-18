import type { DocumentRequestField } from '../types';

export type DocumentTypeDraft = {
  name: string;
  description: string;
  is_active: boolean;
  order_index: number;
  fields: DocumentRequestField[];
};

export const emptyDocumentTypeDraft = (): DocumentTypeDraft => ({
  name: '',
  description: '',
  is_active: true,
  order_index: 0,
  fields: [{
    label: 'Talep nedeni / kullanım amacı',
    field_key: 'purpose',
    field_type: 'textarea',
    is_required: true,
    placeholder: '',
  }],
});

export const makeDocumentFieldKey = (label: string) => label
  .toLocaleLowerCase('tr-TR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/ğ/g, 'g')
  .replace(/ü/g, 'u')
  .replace(/ş/g, 's')
  .replace(/ı/g, 'i')
  .replace(/ö/g, 'o')
  .replace(/ç/g, 'c')
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '') || `alan_${Date.now()}`;
