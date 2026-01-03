// src/hooks/useForm.js
import { useState } from 'react';

const useForm = (initialValues = {}, validateFunction = null) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setValues(prev => ({
      ...prev,
      [name]: newValue
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched(prev => ({
      ...prev,
      [name]: true
    }));

    // Validate on blur if validator exists
    if (validateFunction) {
      const validation = validateFunction(values);
      if (!validation.isValid && validation.errors[name]) {
        setErrors(prev => ({
          ...prev,
          [name]: validation.errors[name]
        }));
      }
    }
  };

  const handleSubmit = (callback) => async (e) => {
    e.preventDefault();

    // Validate all fields
    if (validateFunction) {
      const validation = validateFunction(values);
      if (!validation.isValid) {
        setErrors(validation.errors);
        // Mark all fields as touched
        const allTouched = Object.keys(values).reduce((acc, key) => {
          acc[key] = true;
          return acc;
        }, {});
        setTouched(allTouched);
        return;
      }
    }

    // Clear errors and call callback
    setErrors({});
    await callback(values);
  };

  const resetForm = () => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  };

  const setFieldValue = (name, value) => {
    setValues(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const setFieldError = (name, error) => {
    setErrors(prev => ({
      ...prev,
      [name]: error
    }));
  };

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    setFieldValue,
    setFieldError,
    setValues
  };
};

export default useForm;