import type { Survey, SurveyQuestion } from '../types';

export type DraftQuestion = Omit<SurveyQuestion, 'id' | 'survey_id'>;

export type SurveyDraft = {
  title: string;
  description: string;
  status: Survey['status'];
  questions: DraftQuestion[];
};
