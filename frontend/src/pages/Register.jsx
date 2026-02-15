import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import './Register.css';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Şifre kontrolü
    if (formData.password !== formData.confirmPassword) {
      setError('Şifreler eşleşmiyor!');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır!');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/register/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setError(data.message || 'Kayıt başarısız. Lütfen tekrar deneyin.');
      }
    } catch (err) {
      setError('Sunucu ile bağlantı kurulamadı.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="register-container">
      <motion.div 
        className="register-card"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="register-header">
          <div className="logo-icon">
            <svg viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Truck Body */}
              <rect x="5" y="30" width="60" height="35" rx="3" fill="#1a1a1a" stroke="#ff6b00" strokeWidth="2"/>
              
              {/* Cargo Lines */}
              <line x1="15" y1="30" x2="15" y2="65" stroke="#ff6b00" strokeWidth="1" strokeOpacity="0.5"/>
              <line x1="25" y1="30" x2="25" y2="65" stroke="#ff6b00" strokeWidth="1" strokeOpacity="0.5"/>
              <line x1="35" y1="30" x2="35" y2="65" stroke="#ff6b00" strokeWidth="1" strokeOpacity="0.5"/>
              <line x1="45" y1="30" x2="45" y2="65" stroke="#ff6b00" strokeWidth="1" strokeOpacity="0.5"/>
              <line x1="55" y1="30" x2="55" y2="65" stroke="#ff6b00" strokeWidth="1" strokeOpacity="0.5"/>
              
              {/* Cabin */}
              <path d="M65 40 L65 65 L90 65 L90 50 L80 40 Z" fill="#1a1a1a" stroke="#ff6b00" strokeWidth="2"/>
              
              {/* Window */}
              <path d="M68 44 L68 56 L78 56 L78 48 L73 44 Z" fill="#2a2a2a" stroke="#ff6b00" strokeWidth="1"/>
              
              {/* Headlight */}
              <circle cx="88" cy="58" r="3" fill="#ffcc00"/>
              
              {/* Wheels */}
              <circle cx="23" cy="70" r="8" fill="#1a1a1a" stroke="#ff6b00" strokeWidth="2"/>
              <circle cx="23" cy="70" r="5" fill="#2a2a2a"/>
              <circle cx="23" cy="70" r="3" fill="#ff6b00"/>
              
              <circle cx="75" cy="70" r="8" fill="#1a1a1a" stroke="#ff6b00" strokeWidth="2"/>
              <circle cx="75" cy="70" r="5" fill="#2a2a2a"/>
              <circle cx="75" cy="70" r="3" fill="#ff6b00"/>
              
              {/* Logo */}
              <rect x="28" y="40" width="20" height="12" rx="2" fill="#ff6b00"/>
              <text x="38" y="48.5" textAnchor="middle" fill="#1a1a1a" fontSize="6" fontWeight="bold">KARGO</text>
            </svg>
          </div>
          <h2>Hesap Oluştur</h2>
          <p>Kargo takip sistemine kayıt olun</p>
        </div>

        {error && (
          <motion.div 
            className="error-message"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {error}
          </motion.div>
        )}

        {success && (
          <motion.div 
            className="success-message"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Kayıt başarılı! Giriş sayfasına yönlendiriliyorsunuz...
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="register-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">Ad</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Adınız"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="lastName">Soyad</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Soyadınız"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">E-posta</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="ornek@email.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Şifre</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Şifre Tekrar</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />
          </div>

          <motion.button
            type="submit"
            className="register-button"
            disabled={isLoading || success}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isLoading ? (
              <span className="loading-spinner"></span>
            ) : (
              'Kayıt Ol'
            )}
          </motion.button>
        </form>

        <div className="login-link">
          <p>Zaten hesabınız var mı? <Link to="/login">Giriş Yap</Link></p>
        </div>
      </motion.div>

      {/* Background decoration */}
      <div className="bg-decoration">
        <div className="circle circle-1"></div>
        <div className="circle circle-2"></div>
        <div className="circle circle-3"></div>
      </div>
    </div>
  );
};

export default Register;
