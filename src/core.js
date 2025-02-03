// src/core.js

/**
 * InsaneAnalytics - Client-side analytics tracking library
 */
class InsaneAnalytics {
    constructor(config = {}) {
      this.debug('Constructor called with config:', config);
      
      this.config = {
        endpoint: config.endpoint?.replace(/\/$/, '') || 'https://api.insaneanalytics.com',
        domainId: config.domainId,
        batchSize: config.batchSize || 10,
        batchInterval: config.batchInterval || 5000,
        debug: config.debug || false
      };
  
      // Core state
      this.queue = [];
      this.visitorId = this.getVisitorId();
      this.sessionId = this.generateId();
      this.startTime = Date.now();
      this.lastActiveTime = Date.now();
      this.activeTime = 0;
      this.isActive = false;
      this.initialized = false;
  
      // Metrics
      this.interactions = 0;
      this.maxScrollDepth = 0;
  
      // Bind methods to preserve context
      this.handleActivity = this.handleActivity.bind(this);
      this.handleScroll = this.handleScroll.bind(this);
      this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
      this.handleExit = this.handleExit.bind(this);
  
      // Initialize if domainId is provided
      if (config.domainId) {
        this.init();
      }
    }
  
    init() {
      this.debug('Initializing...');
      if (this.initialized) return;
  
      try {
        this.setupEventListeners();
        this.startBatchProcessing();
        this.trackPerformance();
        this.trackPageview();
        
        this.initialized = true;
        this.debug('Initialization complete');
      } catch (error) {
        console.error('Initialization error:', error);
      }
    }
  
    setupEventListeners() {
      // Activity events
      ['mousemove', 'keypress', 'click'].forEach(event => {
        document.addEventListener(event, this.handleActivity);
      });
  
      // Scroll tracking
      document.addEventListener('scroll', this.handleScroll);
  
      // Visibility
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
  
      // Exit
      window.addEventListener('beforeunload', this.handleExit);
    }
  
    handleActivity() {
      const now = Date.now();
      
      if (!this.isActive) {
        this.isActive = true;
        this.track('activity_start');
      }
  
      if (now - this.lastActiveTime > 1000) {
        this.activeTime += now - this.lastActiveTime;
      }
      
      this.lastActiveTime = now;
      this.interactions++;
    }
  
    handleScroll() {
      const winHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY;
      const currentDepth = Math.round((scrollTop / (docHeight - winHeight)) * 100);
  
      if (currentDepth > this.maxScrollDepth) {
        this.maxScrollDepth = currentDepth;
        this.track('scroll_depth', { depth: this.maxScrollDepth });
      }
    }
  
    handleVisibilityChange() {
      const eventType = document.hidden ? 'page_hide' : 'page_show';
      const data = document.hidden ? {
        activeTime: this.activeTime,
        totalTime: Date.now() - this.startTime
      } : {};
      
      this.track(eventType, data);
    }
  
    handleExit() {
      this.track('page_exit', {
        activeTime: this.activeTime,
        totalTime: Date.now() - this.startTime,
        maxScrollDepth: this.maxScrollDepth,
        interactions: this.interactions
      });
      
      // Force send remaining events
      if (navigator.sendBeacon) {
        const batch = this.queue.splice(0, this.queue.length);
        navigator.sendBeacon(
          `${this.config.endpoint}/collect`,
          JSON.stringify(batch)
        );
      }
    }
  
    trackPerformance() {
      if (!window.performance) return;
  
      // Basic metrics
      const timing = performance.timing;
      const loadTime = timing.loadEventEnd - timing.navigationStart;
      const domLoadTime = timing.domContentLoadedEventEnd - timing.navigationStart;
  
      this.track('performance', {
        loadTime,
        domLoadTime,
        firstPaint: performance.getEntriesByType('paint')[0]?.startTime
      });
  
      // Connection speed
      this.measureConnectionSpeed();
    }
  
    async measureConnectionSpeed() {
      try {
        const startTime = performance.now();
        const response = await fetch(`${this.config.endpoint}/beacon`, {
          cache: 'no-cache'
        });
        const endTime = performance.now();
        
        const duration = endTime - startTime;
        const bodySize = parseInt(response.headers.get('content-length') || 0);
        const speed = (bodySize * 8) / (duration / 1000) / 1000000; // Mbps
  
        this.track('connection_speed', { speed });
      } catch (error) {
        this.debug('Error measuring connection speed:', error);
      }
    }
  
    trackPageview() {
      this.track('pageview', {
        url: window.location.href,
        referrer: document.referrer,
        title: document.title,
        utmParams: this.getUtmParams()
      });
    }
  
    track(eventType, data = {}) {
      const event = {
        eventType,
        timestamp: new Date().toISOString(),
        visitorId: this.visitorId,
        sessionId: this.sessionId,
        domainId: this.config.domainId,
        url: window.location.href,
        userAgent: navigator.userAgent,
        ...data
      };
  
      this.queue.push(event);
      this.debug(`Tracked ${eventType}:`, event);
  
      if (this.queue.length >= this.config.batchSize) {
        this.sendBatch();
      }
    }
  
    startBatchProcessing() {
      setInterval(() => this.sendBatch(), this.config.batchInterval);
    }
  
    async sendBatch() {
      if (this.queue.length === 0) return;
  
      const batch = this.queue.splice(0, this.config.batchSize);
  
      try {
        const response = await fetch(`${this.config.endpoint}/collect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batch),
          keepalive: true
        });
  
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } catch (error) {
        this.debug('Error sending batch:', error);
        this.queue.unshift(...batch);
      }
    }
  
    generateId() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    }
  
    getVisitorId() {
      let id = localStorage.getItem('_ia_vid');
      if (!id) {
        id = this.generateId();
        localStorage.setItem('_ia_vid', id);
      }
      return id;
    }
  
    getUtmParams() {
      const params = new URLSearchParams(window.location.search);
      return {
        source: params.get('utm_source'),
        medium: params.get('utm_medium'),
        campaign: params.get('utm_campaign'),
        term: params.get('utm_term'),
        content: params.get('utm_content')
      };
    }
  
    debug(...args) {
      if (this.config.debug) {
        console.log('[InsaneAnalytics]', ...args);
      }
    }
  }
  
  // Handle async initialization queue
  if (typeof window !== 'undefined') {
    const analytics = new InsaneAnalytics();
    const queue = window.ia?.q || [];
    
    // Process any queued commands
    queue.forEach(args => {
      if (typeof analytics[args[0]] === 'function') {
        analytics[args[0]].apply(analytics, args.slice(1));
      }
    });
  
    // Replace queue with actual instance
    window.ia = function() {
      if (typeof analytics[arguments[0]] === 'function') {
        analytics[arguments[0]].apply(analytics, Array.prototype.slice.call(arguments, 1));
      }
    };
  
    // Export for module environments
    if (typeof module !== 'undefined') {
      module.exports = InsaneAnalytics;
    }
  }