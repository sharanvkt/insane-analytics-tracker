// src/core.js

/**
 * InsaneAnalytics - Client-side analytics tracking library
 * Tracks page views, user engagement, performance metrics, and more
 */
class InsaneAnalytics {
    constructor(config = {}) {
      console.log('InsaneAnalytics: Constructor called with config:', config);
  
      // Core configuration
      this.config = {
        endpoint: config.endpoint || 'https://api.insaneanalytics.com',
        domainId: config.domainId,
        batchSize: config.batchSize || 10,
        batchInterval: config.batchInterval || 5000,
        debug: config.debug || false
      };
  
      // Initialize core state
      this.queue = [];
      this.visitorId = this.getVisitorId();
      this.sessionId = this.generateId();
      this.startTime = Date.now();
      this.lastActiveTime = Date.now();
      this.activeTime = 0;
      this.isActive = false;
      this.initialized = false;
  
      // Performance and engagement metrics
      this.pageLoadTime = null;
      this.scrollDepth = 0;
      this.maxScrollDepth = 0;
      this.interactions = 0;
  
      // Initialize if config is provided
      if (config.domainId) {
        this.init();
      }
    }
  
    /**
     * Initialize tracking and set up event listeners
     */
    init() {
      console.log('InsaneAnalytics: Initializing...');
      if (this.initialized) return;
      this.initialized = true;
  
      try {
        // Track initial page visit
        this.trackPageview();
  
        // Set up core event listeners
        this.setupEventListeners();
  
        // Start batch processing
        this.startBatchProcessing();
  
        // Track performance metrics
        this.trackPerformance();
  
        console.log('InsaneAnalytics: Initialization complete');
      } catch (error) {
        console.error('InsaneAnalytics: Initialization error:', error);
      }
    }
  
    /**
     * Set up all event listeners for tracking
     */
    setupEventListeners() {
      // User activity tracking
      document.addEventListener('mousemove', this.handleActivity.bind(this));
      document.addEventListener('keypress', this.handleActivity.bind(this));
      document.addEventListener('click', this.handleActivity.bind(this));
      document.addEventListener('scroll', this.handleScroll.bind(this));
  
      // Page visibility
      document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
  
      // Before user leaves the page
      window.addEventListener('beforeunload', this.handleExit.bind(this));
    }
  
    /**
     * Handle user activity events
     */
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
  
    /**
     * Track scroll depth
     */
    handleScroll() {
      const winHeight = window.innerHeight;
      const docHeight = Math.max(
        document.documentElement.scrollHeight,
        document.documentElement.offsetHeight,
        document.body.scrollHeight,
        document.body.offsetHeight
      );
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const currentScrollDepth = Math.round((scrollTop / (docHeight - winHeight)) * 100);
  
      if (currentScrollDepth > this.maxScrollDepth) {
        this.maxScrollDepth = currentScrollDepth;
        this.track('scroll_depth', { depth: this.maxScrollDepth });
      }
    }
  
    /**
     * Handle page visibility changes
     */
    handleVisibilityChange() {
      if (document.hidden) {
        this.track('page_hide', {
          activeTime: this.activeTime,
          totalTime: Date.now() - this.startTime
        });
      } else {
        this.track('page_show');
      }
    }
  
    /**
     * Handle page exit
     */
    handleExit() {
      this.track('page_exit', {
        activeTime: this.activeTime,
        totalTime: Date.now() - this.startTime,
        maxScrollDepth: this.maxScrollDepth,
        interactions: this.interactions
      });
      this.sendBatch(true); // Force send on exit
    }
  
    /**
     * Track page load and performance metrics
     */
    trackPerformance() {
      if (window.performance) {
        const timing = performance.timing;
        const loadTime = timing.loadEventEnd - timing.navigationStart;
        const domLoadTime = timing.domContentLoadedEventEnd - timing.navigationStart;
  
        this.track('performance', {
          loadTime,
          domLoadTime,
          firstPaint: performance.getEntriesByType('paint')[0]?.startTime
        });
  
        // Measure connection speed
        this.measureConnectionSpeed();
      }
    }
  
    /**
     * Measure connection speed
     */
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
  
    /**
     * Track page view
     */
    trackPageview() {
      this.track('pageview', {
        url: window.location.href,
        referrer: document.referrer,
        title: document.title,
        utmParams: this.getUtmParams()
      });
    }
  
    /**
     * Queue an event for tracking
     */
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
  
    /**
     * Start batch processing interval
     */
    startBatchProcessing() {
      setInterval(() => {
        this.sendBatch();
      }, this.config.batchInterval);
    }
  
    /**
     * Send batch of events to server
     */
    async sendBatch(sync = false) {
      if (this.queue.length === 0) return;
  
      const batch = this.queue.splice(0, this.config.batchSize);
  
      if (sync && navigator.sendBeacon) {
        navigator.sendBeacon(
          `${this.config.endpoint}/collect`,
          JSON.stringify(batch)
        );
        return;
      }
  
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
        // Re-queue failed events
        this.queue.unshift(...batch);
      }
    }
  
    // Utility methods
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
  
  // Export for both browser and module environments
  if (typeof window !== 'undefined') {
    window.InsaneAnalytics = InsaneAnalytics;
  } else {
    module.exports = InsaneAnalytics;
  }
  
  // Handle async initialization queue
  if (typeof window !== 'undefined' && window.ia && window.ia.q) {
    const queue = window.ia.q;
    window.ia = function() {
      const analytics = new InsaneAnalytics();
      for (const args of queue) {
        if (typeof analytics[args[0]] === 'function') {
          analytics[args[0]].apply(analytics, args.slice(1));
        }
      }
      return analytics;
    };
  }