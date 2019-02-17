# puzzle_server.py

import os
import cherrypy
import json

class PuzzleServer(object):
    def __init__(self, root_dir):
        self.root_dir = root_dir

    @cherrypy.expose
    def default(self, **kwargs):
        return cherrypy.lib.static.serve_file(self.root_dir + '/puzzle_page.html', content_type='text/html')

    @cherrypy.expose
    @cherrypy.tools.json_out()
    def puzzle_list(self, **kwargs):
        try:
            import inspect
            import puzzle_definitions
            class_list = inspect.getmembers(puzzle_definitions, inspect.isclass)
            puzzle_list = []
            for cls in class_list:
                cls_str = str(cls)
                if cls_str.find('puzzle_definitions') >= 0:
                    puzzle_list.append(cls[0])
            return puzzle_list
        except Exception as ex:
            return {'error': str(ex)}

if __name__ == '__main__':
    root_dir = os.path.dirname(os.path.abspath(__file__))
    port = int(os.environ.get('PORT', 5200))
    server = PuzzleServer(root_dir)
    config = {
        'global': {
            'server.socket_host': '0.0.0.0',
            'server.socket_port': port,
        },
        '/': {
            'tools.staticdir.root': root_dir,
            'tools.staticdir.on': True,
            'tools.staticdir.dir': '',
        }
    }
    cherrypy.quickstart(server, '/', config=config)