import type { LessonDraft, QuizQuestion, Video } from '../types';

export const initialVideoForm = {
  title: '',
  description: '',
  category: '',
  pass_score: '70',
  trainer_name: '',
  trainer_title: '',
  duration: '',
  validity_period: '',
  awards_badge: true,
  certificate_enabled: true,
  auto_reassign_enabled: false,
  validity_amount: '',
  validity_unit: 'year',
  pause_on_blur: false,
  disable_forward_seek: false,
  quiz_attempt_limit: '',
  training_profile: 'standard',
  delivery_method: 'online',
  is_mandatory: true,
  compliance_lock: false,
  minimum_watch_percent: '100',
  requires_full_watch: true,
  requires_quiz: false,
  cover_image_url: '',
  badge_image_url: '',
};

export type TrainingForm = typeof initialVideoForm;
type BooleanTrainingField = {
  [Key in keyof TrainingForm]: TrainingForm[Key] extends boolean ? Key : never
}[keyof TrainingForm];

interface TrainingPolicyToggle {
  field: BooleanTrainingField;
  label: string;
  videoOnly?: boolean;
}

export const trainingPolicyToggles: readonly TrainingPolicyToggle[] = [
  { field: 'certificate_enabled', label: 'Sertifika oluşturulsun' },
  { field: 'awards_badge', label: 'Rozet verilsin' },
  { field: 'auto_reassign_enabled', label: 'Süresi dolunca otomatik tekrar atansın' },
  { field: 'requires_quiz', label: 'Her modülde sınav zorunlu olsun' },
  { field: 'pause_on_blur', label: 'Sekme değişince video dursun', videoOnly: true },
  { field: 'disable_forward_seek', label: 'Videoyu ileri sarma kapalı olsun', videoOnly: true },
  { field: 'requires_full_watch', label: 'Tam izleme koşulu aransın' },
];

export const normalizeTrainingFormForLessons = (
  form: TrainingForm,
  lessons: LessonDraft[],
): TrainingForm => {
  if (lessons.some((lesson) => lesson.content_type === 'video')) return form;
  return {
    ...form,
    pause_on_blur: false,
    disable_forward_seek: false,
  };
};

export const createEmptyLesson = (): LessonDraft => ({
  clientKey: crypto.randomUUID(),
  title: '',
  url: '',
  description: '',
  content_type: 'video',
  content_metadata: {},
  required_seconds: '',
  required_percent: '100',
  file: null,
  quizQuestions: [],
});

export type TrainingModuleDraft = {
  clientKey: string;
  title: string;
  description: string;
  contents: LessonDraft[];
  quizQuestions: QuizQuestion[];
};

export const createEmptyModule = (): TrainingModuleDraft => ({
  clientKey: crypto.randomUUID(),
  title: '',
  description: '',
  contents: [createEmptyLesson()],
  quizQuestions: [],
});

export const appendTrainingModules = (formData: FormData, modules: TrainingModuleDraft[]) => {
  let fileIndex = 0;
  const metadata = modules.map((module) => ({
    title: module.title,
    description: module.description,
    contents: module.contents.map((content) => {
      if (content.file) formData.append(`lesson_${fileIndex}_file`, content.file);
      fileIndex += 1;
      return {
        title: content.title,
        url: content.url,
        description: content.description,
        content_type: content.content_type,
        content_metadata: content.content_metadata || {},
        required_seconds: content.required_seconds || '',
        required_percent: content.required_percent || '',
        file_name: content.file?.name || '',
      };
    }),
    quizData: module.quizQuestions.length ? { questions: module.quizQuestions } : null,
  }));
  formData.append('modules', JSON.stringify(metadata));
};

export type VideoLessonResponse = Partial<LessonDraft> & {
  id?: number;
  module_id?: number;
  module_title?: string;
  module_description?: string;
  quizData?: { questions?: QuizQuestion[] };
};

export const modulesFromLessons = (lessons: VideoLessonResponse[]): TrainingModuleDraft[] => {
  const grouped = new Map<number, TrainingModuleDraft>();
  lessons.forEach((lesson, index) => {
    const id = lesson.module_id ?? -(index + 1);
    if (!grouped.has(id)) {
      grouped.set(id, { clientKey: crypto.randomUUID(), title: lesson.module_title || lesson.title || '', description: lesson.module_description || '', contents: [], quizQuestions: [] });
    }
    const module = grouped.get(id)!;
    module.contents.push({
      clientKey: crypto.randomUUID(),
      title: lesson.title || '',
      url: lesson.url || '',
      description: lesson.description || '',
      content_type: lesson.content_type === 'pdf' ? 'pdf' : 'video',
      content_metadata: lesson.content_metadata || {},
      required_seconds: String(lesson.required_seconds || ''),
      required_percent: String(lesson.required_percent || (lesson.content_type === 'pdf' ? '80' : '100')),
      file: null,
      quizQuestions: [],
    });
    if (Array.isArray(lesson.quizData?.questions)) module.quizQuestions = lesson.quizData.questions;
  });
  return [...grouped.values()];
};

export const trainingProfiles = [
  { value: 'free', label: 'Serbest Eğitim' },
  { value: 'standard', label: 'Standart Şirket Eğitimi' },
  { value: 'supervised', label: 'Denetimli Eğitim' },
  { value: 'compliance', label: 'İSG / Kanuni Uyum Eğitimi' },
];

export const applyTrainingProfile = (profile: string) => {
  if (profile === 'free') {
    return {
      training_profile: profile,
      is_mandatory: false,
      compliance_lock: false,
      pause_on_blur: false,
      disable_forward_seek: false,
      requires_full_watch: false,
      requires_quiz: false,
      minimum_watch_percent: '0',
      quiz_attempt_limit: '',
      certificate_enabled: false,
      awards_badge: false,
    };
  }
  if (profile === 'supervised') {
    return {
      training_profile: profile,
      is_mandatory: true,
      compliance_lock: false,
      pause_on_blur: true,
      disable_forward_seek: true,
      requires_full_watch: true,
      requires_quiz: true,
      minimum_watch_percent: '100',
      quiz_attempt_limit: '2',
      certificate_enabled: true,
      awards_badge: true,
    };
  }
  if (profile === 'compliance') {
    return {
      training_profile: profile,
      is_mandatory: true,
      compliance_lock: true,
      pause_on_blur: true,
      disable_forward_seek: true,
      requires_full_watch: true,
      requires_quiz: true,
      minimum_watch_percent: '100',
      quiz_attempt_limit: '2',
      certificate_enabled: true,
      awards_badge: true,
    };
  }
  return {
    training_profile: profile,
    is_mandatory: true,
    compliance_lock: false,
    pause_on_blur: false,
    disable_forward_seek: false,
    requires_full_watch: true,
    requires_quiz: false,
    minimum_watch_percent: '100',
    quiz_attempt_limit: '',
    certificate_enabled: true,
    awards_badge: true,
  };
};

export const videoToForm = (video: Video) => ({
  title: video.title || '',
  description: video.description || '',
  category: video.category || '',
  pass_score: String(video.pass_score ?? '70'),
  trainer_name: video.trainer_name || '',
  trainer_title: video.trainer_title || '',
  duration: video.duration || '',
  validity_period: String(video.validity_period || ''),
  awards_badge: video.awards_badge !== 0 && video.awards_badge !== false,
  certificate_enabled: video.certificate_enabled !== 0 && video.certificate_enabled !== false,
  auto_reassign_enabled: video.auto_reassign_enabled === 1 || video.auto_reassign_enabled === true,
  validity_amount: String(video.validity_amount || ''),
  validity_unit: video.validity_unit || 'year',
  pause_on_blur: video.pause_on_blur === 1 || video.pause_on_blur === true,
  disable_forward_seek: video.disable_forward_seek === 1 || video.disable_forward_seek === true,
  quiz_attempt_limit: String(video.quiz_attempt_limit || ''),
  training_profile: video.training_profile || 'standard',
  delivery_method: video.delivery_method || 'online',
  is_mandatory: video.is_mandatory !== 0 && video.is_mandatory !== false,
  compliance_lock: video.compliance_lock === 1 || video.compliance_lock === true,
  minimum_watch_percent: String(video.minimum_watch_percent ?? '100'),
  requires_full_watch: video.requires_full_watch !== 0 && video.requires_full_watch !== false,
  requires_quiz: video.requires_quiz !== 0 && video.requires_quiz !== false,
  cover_image_url: video.cover_image_url || '',
  badge_image_url: video.badge_image_url || '',
});
