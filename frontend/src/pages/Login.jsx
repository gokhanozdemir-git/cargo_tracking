import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import DeliveryTruck from '../components/DeliveryTruck';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [truckPosition, setTruckPosition] = useState('arriving');
  const [error, setError] = useState('');

  useEffect(() => {
    // Sayfa yüklendiğinde araba gelsin
    const timer = setTimeout(() => {
      setTruckPosition('stopped');
    }, 100);
    return () => clearTimeout(timer);
  }, []);

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

    try {
      // Backend'e giriş isteği
      const response = await fetch('http://localhost:8000/api/login/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        // Giriş başarılı - araba yola devam etsin
        setTruckPosition('leaving');
        
        // Kullanıcı bilgilerini localStorage'a kaydet
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('token', data.token);

        // Animasyon bittikten sonra role'e göre yönlendir
        setTimeout(() => {
          if (data.user.role === 'admin') {
            navigate('/yonetici');
          } else {
            navigate('/kullanici');
          }
        }, 1500);
      } else {
        setError(data.message || 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Sunucu ile bağlantı kurulamadı.');
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Sol taraf - Araba animasyonu */}
      <div className="login-left">
        <div className="road">
          <div className="road-line"></div>
        </div>
        <motion.div
          className="truck-wrapper"
          initial={{ x: '-100%' }}
          animate={{
            x: truckPosition === 'arriving' ? '-100%' : 
               truckPosition === 'stopped' ? '0%' : '150%'
          }}
          transition={{ 
            duration: truckPosition === 'leaving' ? 1.5 : 2,
            ease: truckPosition === 'leaving' ? 'easeIn' : 'easeOut'
          }}
        >
          <DeliveryTruck className="delivery-truck" />
        </motion.div>
        <div className="brand-text">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
          >
            KARGO TAKİP
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.8 }}
          >
            Hızlı, Güvenilir, Profesyonel
          </motion.p>
        </div>
      </div>

      {/* Sağ taraf - Login formu */}
      <motion.div 
        className="login-right"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.5 }}
      >
        <div className="login-form-container">
          <div className="login-header">
            <h2>Hoş Geldiniz</h2>
            <p>Hesabınıza giriş yapın</p>
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

          <form onSubmit={handleSubmit} className="login-form">
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

            <div className="form-options">
              <label className="remember-me">
                <input type="checkbox" />
                <span>Beni hatırla</span>
              </label>
              <Link to="/forgot-password" className="forgot-password">
                Şifremi unuttum
              </Link>
            </div>

            <motion.button
              type="submit"
              className="login-button"
              disabled={isLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isLoading ? (
                <span className="loading-spinner"></span>
              ) : (
                'Giriş Yap'
              )}
            </motion.button>
          </form>

          <div className="register-link">
            <p>Hesabınız yok mu? <Link to="/register">Kayıt Ol</Link></p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
