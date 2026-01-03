// src/hooks/useModal.js
import { useState } from 'react';

const useModal = (initialState = false) => {
  const [isOpen, setIsOpen] = useState(initialState);
  const [data, setData] = useState(null);

  const openModal = (modalData = null) => {
    setData(modalData);
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setData(null);
  };

  const toggleModal = () => {
    setIsOpen(prev => !prev);
    if (isOpen) {
      setData(null);
    }
  };

  return {
    isOpen,
    data,
    openModal,
    closeModal,
    toggleModal
  };
};

export default useModal;