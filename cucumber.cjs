module.exports = {
  default: {
    paths: ['features/**/*.feature'],
    import: ['features/step_definitions/**/*.js'],
    // Terminal + rapport HTML autonome (reports/cucumber-report.html)
    format: ['progress', 'html:reports/cucumber-report.html'],
  },
};
