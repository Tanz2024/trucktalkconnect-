/**
 * Clear existing AI analysis sections to prevent duplicates
 */
function clearExistingAIAnalysisSections() {
  console.log('Clearing existing AI analysis sections...');
  var sectionSelectors = ['.ai-analysis-section', '.ai-changes-section', '.ai-autofixes-section'];
  var totalCleared = 0;
  sectionSelectors.forEach(selector => {
    var existingSections = document.querySelectorAll(selector);
    existingSections.forEach(section => {
      console.log('Removing existing section: ' + selector);
      section.remove();
      totalCleared++;
    });
  });
  console.log('Cleared ' + totalCleared + ' existing AI sections total');
}
