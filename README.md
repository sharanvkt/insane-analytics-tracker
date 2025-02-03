# Insane Analytics Tracker

A lightweight, efficient analytics tracking script that captures user behavior, performance metrics, and engagement data.

## Features
- Page view tracking
- User session management
- Performance metrics
- Scroll depth tracking
- Active time measurement
- UTM parameter tracking
- Connection speed measurement
- Batch processing support

## Installation

Add this script to your HTML:

```html
<script>
(function(w,d,s,o,f,js,fjs){
    w['InsaneAnalytics']=o;w[o]=w[o]||function(){
    (w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
    js.async=1;js.src=f;fjs.parentNode.insertBefore(js,fjs);
}(window,document,'script','ia','https://cdn.jsdelivr.net/gh/yourusername/insane-analytics-tracker@main/dist/analytics.min.js'));

ia('init', {
    domainId: 'YOUR_DOMAIN_ID',
    endpoint: 'https://your-api-endpoint.com'
});
</script>