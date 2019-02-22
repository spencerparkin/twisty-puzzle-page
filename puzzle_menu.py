# puzzle_menu.py

import os
import sys
import json

sys.path.append(r'c:\dev\pyMath3d')

from OpenGL.GL import *
from OpenGL.GLU import *
from PyQt5 import QtGui, QtCore, QtWidgets
from math3d_vector import Vector
from puzzle_generator import ColoredMesh

class Window(QtGui.QOpenGLWindow):
    def __init__(self, parent=None):
        super().__init__(parent)

    def initializeGL(self):
        glEnable(GL_DEPTH_TEST)
        glClearColor(0.0, 0.0, 0.0, 0.0)

        glEnable(GL_LIGHTING)
        glEnable(GL_LIGHT0)

        glShadeModel(GL_SMOOTH)

        glLightfv(GL_LIGHT0, GL_POSITION, [1.0, 1.0, 1.0, 0.0])
        glLightfv(GL_LIGHT0, GL_AMBIENT, [1.0, 1.0, 1.0, 1.0])
        glLightfv(GL_LIGHT0, GL_DIFFUSE, [1.0, 1.0, 1.0, 1.0])

        glEnable(GL_BLEND)
        glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA)

        glEnable(GL_CULL_FACE)
        glCullFace(GL_BACK)

    def paintGL(self):
        # The window is not meant to stick around.  We're just using it to generate images for the puzzle menu.
        
        for root, dir_list, file_list in os.walk(os.getcwd() + '/puzzles'):
            for file in file_list:
                puzzle_file = os.path.join(root, file)
                print('Processing %s...' % puzzle_file)
                with open(puzzle_file, 'r') as handle:
                    json_text = handle.read()
                    puzzle_data = json.loads(json_text)
                    
                    mesh_list = []
                    for mesh_data in puzzle_data.get('mesh_list', []):
                        mesh = ColoredMesh().from_dict(mesh_data)
                        mesh_list.append(mesh)
                    
                    self._render_puzzle(mesh_list)
                    
                    image = self.grabFramebuffer()
                    name, ext = os.path.splitext(file)
                    image_file = os.getcwd() + '/menu/' + name + '.jpg'
                    image.save(image_file)
        
        app.quit()
    
    def _render_puzzle(self, mesh_list):
    
        glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT)

        viewport = glGetIntegerv(GL_VIEWPORT)
        width = viewport[2]
        height = viewport[3]

        aspect_ratio = float(width) / float(height)

        glMatrixMode(GL_PROJECTION)
        glLoadIdentity()
        gluPerspective(60.0, aspect_ratio, 0.1, 1000.0)

        glMatrixMode(GL_MODELVIEW)
        glLoadIdentity()
        gluLookAt(0.0, 0.0, 4.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0)

        orient = Vector(-35.0, 45.0, 0.0)

        glPushMatrix()
        glRotatef(orient.x, 1.0, 0.0, 0.0)
        glRotatef(orient.y, 0.0, 1.0, 0.0)
        glRotatef(orient.z, 0.0, 0.0, 1.0)

        for mesh in mesh_list:
            mesh.render()

        glPopMatrix()

        glFlush()

    def resizeGL(self, width, height):
        pass  # glViewport(0, 0, width, height)

def exceptionHook(cls, exc, tb):
    sys.__excepthook__(cls, exc, tb)

if __name__ == '__main__':
    sys.excepthook = exceptionHook

    app = QtGui.QGuiApplication(sys.argv)

    win = Window()
    win.resize(512, 512)
    win.show()

    sys.exit(app.exec_())