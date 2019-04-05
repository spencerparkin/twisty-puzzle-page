# puzzle_preview.py

import argparse
import sys
import json
import gzip

sys.path.append(r'c:\dev\pyMath3d')

from OpenGL.GL import *
from OpenGL.GLU import *
from PyQt5 import QtGui, QtCore, QtWidgets
from math3d_triangle_mesh import TriangleMesh, Polyhedron
from math3d_triangle import Triangle
from math3d_vector import Vector
from math3d_sphere import Sphere
from math3d_transform import AffineTransform, LinearTransform
from math3d_point_cloud import PointCloud

class PuzzlePreview(object):
    def __init__(self, puzzle_class_name):
        from puzzle_generator import ColoredMesh

        self.mesh_list = []
        puzzle_path = 'puzzles/' + puzzle_class_name + '.json.gz'
        with gzip.open(puzzle_path, 'rb') as handle:
            json_bytes = handle.read()
            json_text = json_bytes.decode('utf-8')
            puzzle_data = json.loads(json_text)
            for mesh_data in puzzle_data.get('mesh_list', []):
                mesh = ColoredMesh().from_dict(mesh_data)
                self.mesh_list.append(mesh)

    def render(self):
        glEnable(GL_LIGHTING)

        for mesh in self.mesh_list:
            mesh.render()

        glDisable(GL_LIGHTING)

        for mesh in self.mesh_list:
            mesh.render_border()

class PreviewWindow(QtGui.QOpenGLWindow):
    def __init__(self, puzzle_class_name, parent=None):
        super().__init__(parent)

        self.orient = Vector(0.0, 0.0, 0.0)
        self.dragging_mouse = False
        self.drag_pos = None
        self.zoom = 5.0
        
        self.puzzle_preview = PuzzlePreview(puzzle_class_name)

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
        gluLookAt(0.0, 0.0, self.zoom, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0)

        glPushMatrix()
        glRotatef(self.orient.x, 1.0, 0.0, 0.0)
        glRotatef(self.orient.y, 0.0, 1.0, 0.0)
        glRotatef(self.orient.z, 0.0, 0.0, 1.0)

        self.puzzle_preview.render()

        glPopMatrix()

        glFlush()

    def resizeGL(self, width, height):
        pass #glViewport(0, 0, width, height)

    def mousePressEvent(self, event):
        button = event.button()
        if button == QtCore.Qt.LeftButton:
            self.dragging_mouse = True
            self.drag_pos = event.localPos()

    def mouseMoveEvent(self, event):
        if self.dragging_mouse:
            pos = event.localPos()
            delta = pos - self.drag_pos
            self.drag_pos = pos
            sensativity_factor = 2.0
            self.orient.x += sensativity_factor * float(delta.y())
            self.orient.y += sensativity_factor * float(delta.x())
            self.update()

    def mouseReleaseEvent(self, event):
        if self.dragging_mouse:
            self.dragging_mouse = False
            self.drag_pos = None

    def wheelEvent(self, event):
        delta = event.angleDelta()
        delta = float(delta.y()) / 120.0
        zoom_factor = 0.5
        self.zoom += delta * zoom_factor
        self.update()

def exceptionHook(cls, exc, tb):
    sys.__excepthook__(cls, exc, tb)

if __name__ == '__main__':
    sys.excepthook = exceptionHook

    arg_parser = argparse.ArgumentParser()
    arg_parser.add_argument('puzzle', help='Specify which puzzle to preview.', type=str)
    args = arg_parser.parse_args()

    app = QtGui.QGuiApplication(sys.argv)

    win = PreviewWindow(args.puzzle)
    win.resize(640, 480)
    win.show()

    sys.exit(app.exec_())