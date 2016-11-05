module.exports = function(grunt) {
    grunt.initConfig({
    assembler: {
        build: {
            options: {
                css: "build/css/style.css",
                js: "build/js/script.js",
                output: "build/html/index.html"
            }
        },
        dev: {
            options: {
                css: "snippets/css/style.css",
                js: "snippets/js/script.js",
                output: "docs/debug.html"
            }
        }
    },
    cssmin: {
        preBuild: {
            files: {
                'build/css/style.css': 'snippets/css/style.css'
            }
        }
    },
    htmlmin: {
        postBuild: {
            options: {
                removeComments: true,
                collapseWhitespace: true,
                maxLineLength: 32000
            },
            src: 'build/html/index.html',
            dest: 'docs/index.html'
        }
    },
    uglify: {
        preBuild: {
            src: 'snippets/js/script.js',
            dest: 'build/js/script.js'
        }
    }
    });

    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-htmlmin');
    grunt.loadNpmTasks('grunt-contrib-uglify');

    grunt.loadTasks('tasks');

    grunt.registerTask('dev', ['assembler:dev']);
    grunt.registerTask('build', ['uglify:preBuild', 'cssmin:preBuild', 'assembler:build', 'htmlmin:postBuild']);
    grunt.registerTask('default', ['dev', 'build']);
};