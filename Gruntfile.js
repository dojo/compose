module.exports = function (grunt) {
	require('grunt-dojo2').initConfig(grunt, {
		dtsGenerator: {
			options: {
				main: 'dojo-compose/main'
			}
		}
	});
};
