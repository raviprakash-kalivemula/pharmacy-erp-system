import { useState, useCallback, useRef, useEffect } from 'react';
import toastQueue from '../utils/toastQueue';

const useFormWithAutoSave = (initialData, onSave, autoSaveDelay = 2000) => {
  const [formData, setFormData] = useState(initialData);
  const [errors, setErrors] = useState({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (unsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [unsavedChanges]);

  const validateField = useCallback((name, value) => {
    if (!value && ['email', 'phone'].includes(name)) {
      return \\ is required\;
    }
    if (name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+\$/.test(value)) {
      return 'Invalid email format';
    }
    if (name === 'phone' && !/^\d{10}\$/.test(value?.replace(/\D/g, ''))) {
      return 'Phone must be 10 digits';
    }
    return '';
  }, []);

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    setFormData(prev => ({ ...prev, [name]: newValue }));
    setDirty(true);
    setUnsavedChanges(true);

    const error = validateField(name, newValue);
    setErrors(prev => ({
      ...prev,
      [name]: error
    }));

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      handleAutoSave(formData);
    }, autoSaveDelay);
  }, [validateField, autoSaveDelay, formData]);

  const handleAutoSave = useCallback(async (data) => {
    try {
      setSaving(true);
      await onSave(data, true);
      setUnsavedChanges(false);
      toastQueue.success('Auto-saved', { duration: 1500 });
    } catch (err) {
      toastQueue.error('Auto-save failed');
    } finally {
      setSaving(false);
    }
  }, [onSave]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    
    const newErrors = {};
    Object.keys(formData).forEach(key => {
      const error = validateField(key, formData[key]);
      if (error) newErrors[key] = error;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toastQueue.error('Please fix errors before submitting');
      return;
    }

    try {
      setSaving(true);
      await onSave(formData, false);
      setDirty(false);
      setUnsavedChanges(false);
      toastQueue.success('Saved successfully');
    } catch (err) {
      toastQueue.error('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  }, [formData, validateField, onSave]);

  const reset = useCallback(() => {
    setFormData(initialData);
    setErrors({});
    setDirty(false);
    setUnsavedChanges(false);
  }, [initialData]);

  return {
    formData,
    setFormData,
    errors,
    dirty,
    saving,
    unsavedChanges,
    handleChange,
    handleSubmit,
    reset,
    validateField
  };
};

export default useFormWithAutoSave;
